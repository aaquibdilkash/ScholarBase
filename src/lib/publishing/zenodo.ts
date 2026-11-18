import "server-only";

import { MANUSCRIPT_PDF_MIME } from "@/lib/publishing/constants";

/**
 * Zenodo deposit client.
 *
 * Zenodo is the free bridge to a real DOI (prefix `10.5281`, sandbox `10.5072`)
 * until a Crossref membership is affordable. The legacy deposit API is used
 * because it is the only one that supports "create → upload → publish" in a few
 * JSON calls without a DataCite account:
 *
 *   POST   /deposit/depositions                    → id + links.bucket
 *   PUT    {bucket}/{filename}                     → file bytes
 *   PUT    /deposit/depositions/{id}               → metadata
 *   POST   /deposit/depositions/{id}/actions/publish
 *   GET    /deposit/depositions/{id}                → state, doi, record_url
 *
 * Every function is called from a Server Action only. The token is read at call
 * time (never at module load) so a build without `ZENODO_TOKEN` still compiles
 * and the action can degrade with an honest message instead of crashing.
 *
 * A Zenodo DOI resolves to the Zenodo record, not to this site. The metadata
 * therefore points back here with a `related_identifiers` `isIdenticalTo` entry
 * and a link in the description. Only a Crossref/DataCite membership with a
 * custom landing page can make `doi.org/<prefix>` land on our domain.
 */

const PRODUCTION_BASE = "https://zenodo.org/api";
const SANDBOX_BASE = "https://sandbox.zenodo.org/api";
const REQUEST_TIMEOUT_MS = 30_000;

export type ZenodoMetadata = Record<string, unknown>;

export type ZenodoDeposit = {
  id: string;
  state: string;
  submitted: boolean;
  /** Bare DOI (`10.5281/zenodo.123`), never a `https://doi.org/` URL. */
  doi: string | null;
  doiUrl: string | null;
  recordUrl: string | null;
  /** Pre-signed upload target; present on newly created and unfinished deposits. */
  bucketUrl: string | null;
  /** File names already attached, so a resume never uploads twice. */
  fileNames: readonly string[];
};

export class ZenodoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZenodoError";
  }
}

type RawDeposition = {
  id?: number | string;
  state?: string;
  submitted?: boolean;
  doi?: string;
  doi_url?: string;
  links?: {
    bucket?: string;
    html?: string;
    record_html?: string;
  };
  files?: Array<{ filename?: string }>;
};

function apiBaseUrl(): string {
  const explicit = process.env.ZENODO_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const sandbox = process.env.ZENODO_SANDBOX?.trim().toLowerCase();
  return sandbox === "true" || sandbox === "1" ? SANDBOX_BASE : PRODUCTION_BASE;
}

function token(): string {
  return process.env.ZENODO_TOKEN?.trim() ?? "";
}

/** The UI shows a "configure the token" state instead of a dead button. */
export function isZenodoConfigured(): boolean {
  return token().length > 0;
}

function requireToken(): string {
  const value = token();
  if (!value) {
    throw new ZenodoError(
      "DOI minting is not configured. Add ZENODO_TOKEN to the environment.",
    );
  }
  return value;
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${apiBaseUrl()}${value.startsWith("/") ? "" : "/"}${value}`;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function failure(response: Response, label: string): Promise<ZenodoError> {
  let detail = "";
  try {
    detail = (await response.text()).trim().slice(0, 300);
  } catch {
    // The status alone is still actionable.
  }
  return new ZenodoError(
    `${label} returned ${response.status}${detail ? `: ${detail}` : ""}.`,
  );
}

async function zenodoJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authorization = `Bearer ${requireToken()}`;
  const response = await request(absoluteUrl(path), {
    ...init,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) throw await failure(response, "Zenodo");

  const body = await response.text();
  // Zenodo answers `202 Accepted` on publish; an empty body is still success.
  return (body.trim() ? JSON.parse(body) : null) as T;
}

export function normalizeDoi(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

function toDeposit(raw: RawDeposition): ZenodoDeposit {
  if (raw.id === undefined || raw.id === null || String(raw.id).trim() === "") {
    throw new ZenodoError("Zenodo returned a deposit without an id.");
  }

  const submitted = raw.submitted ?? raw.state === "done";
  const doiUrl = raw.doi_url?.trim() || null;

  return {
    id: String(raw.id),
    state: raw.state ?? (submitted ? "done" : "inprogress"),
    submitted,
    doi: normalizeDoi(raw.doi),
    doiUrl,
    recordUrl:
      raw.links?.record_html?.trim() ||
      raw.links?.html?.trim() ||
      doiUrl ||
      null,
    bucketUrl: raw.links?.bucket?.trim() || null,
    fileNames: (raw.files ?? []).flatMap((file) =>
      file.filename ? [file.filename] : [],
    ),
  };
}

/**
 * A deposit filename Zenodo accepts and a reader recognises. Falls back to the
 * manuscript id so every record has a stable, obviously-PDF payload name.
 */
export function zenodoFileName(
  originalName: string | null | undefined,
  fallbackId: string,
): string {
  const base = (originalName ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const stem = base.replace(/\.pdf$/i, "") || fallbackId;
  return `${stem}.pdf`;
}

export async function createZenodoDeposit(): Promise<ZenodoDeposit> {
  const raw = await zenodoJson<RawDeposition>("/deposit/depositions", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return toDeposit(raw);
}

/**
 * Uploads one PDF to the pre-signed bucket URL. The bucket URL is already
 * authorised, so the access token is deliberately not sent with the bytes.
 */
export async function uploadZenodoFile(
  bucketUrl: string,
  fileName: string,
  pdf: ArrayBuffer,
): Promise<void> {
  const response = await request(
    `${bucketUrl.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`,
    {
      method: "PUT",
      headers: { "Content-Type": MANUSCRIPT_PDF_MIME },
      body: pdf,
    },
  );

  if (!response.ok) throw await failure(response, "Zenodo upload");
}

export async function setZenodoMetadata(
  depositId: string,
  metadata: ZenodoMetadata,
): Promise<ZenodoDeposit> {
  const raw = await zenodoJson<RawDeposition>(
    `/deposit/depositions/${encodeURIComponent(depositId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ metadata }),
    },
  );
  return toDeposit(raw);
}

export async function publishZenodoDeposit(
  depositId: string,
): Promise<ZenodoDeposit> {
  const raw = await zenodoJson<RawDeposition | null>(
    `/deposit/depositions/${encodeURIComponent(depositId)}/actions/publish`,
    { method: "POST", body: JSON.stringify({}) },
  );

  // Zenodo answers `202 Accepted`; a missing body is still a success, so read
  // the deposit back rather than reporting a mint that may have happened.
  return raw ? toDeposit(raw) : getZenodoDeposit(depositId);
}

export async function getZenodoDeposit(
  depositId: string,
): Promise<ZenodoDeposit> {
  const raw = await zenodoJson<RawDeposition>(
    `/deposit/depositions/${encodeURIComponent(depositId)}`,
    { method: "GET" },
  );
  return toDeposit(raw);
}
