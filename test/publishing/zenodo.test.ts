/**
 * Zenodo deposit client.
 *
 * The client is thin, so these tests pin the parts that would silently corrupt a
 * record: which host a sandbox run talks to, that the upload target is not sent
 * our token, that an empty `202` publish response is read back, and that a DOI
 * copied from a URL is stored bare.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createZenodoDeposit,
  getZenodoDeposit,
  isZenodoConfigured,
  normalizeDoi,
  publishZenodoDeposit,
  uploadZenodoFile,
  zenodoFileName,
} from "@/lib/publishing/zenodo";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("ZENODO_TOKEN", "test-token");
  vi.stubEnv("ZENODO_API_URL", "");
  vi.stubEnv("ZENODO_SANDBOX", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("configuration", () => {
  it("is unconfigured without a token", () => {
    vi.stubEnv("ZENODO_TOKEN", "");
    expect(isZenodoConfigured()).toBe(false);
  });

  it("talks to the sandbox when the switch is on", async () => {
    vi.stubEnv("ZENODO_SANDBOX", "true");
    fetchMock.mockResolvedValue(jsonResponse({ id: 42, links: { bucket: "https://bucket" } }));

    await createZenodoDeposit();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.zenodo.org/api/deposit/depositions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("honours an explicit API base for a proxy or self-hosted sandbox", async () => {
    vi.stubEnv("ZENODO_API_URL", "https://zenodo.internal/api/");
    fetchMock.mockResolvedValue(jsonResponse({ id: 42 }));

    await createZenodoDeposit();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://zenodo.internal/api/deposit/depositions",
      expect.anything(),
    );
  });
});

describe("deposit lifecycle", () => {
  it("returns the bucket from a newly created deposit", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 42,
        state: "unsubmitted",
        links: { bucket: "https://zenodo.org/api/files/abc", html: "https://zenodo.org/deposit/42" },
      }),
    );

    const deposit = await createZenodoDeposit();

    expect(deposit).toMatchObject({
      id: "42",
      submitted: false,
      bucketUrl: "https://zenodo.org/api/files/abc",
    });
  });

  it("uploads the PDF without leaking the API token to the pre-signed bucket", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    await uploadZenodoFile(
      "https://zenodo.org/api/files/abc/",
      "A paper.pdf",
      new ArrayBuffer(8),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://zenodo.org/api/files/abc/A%20paper.pdf");
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({ "Content-Type": "application/pdf" });
    expect(JSON.stringify(init.headers)).not.toContain("test-token");
  });

  it("reads the deposit back when publish returns an empty 202", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          state: "done",
          submitted: true,
          doi: "10.5281/zenodo.42",
          doi_url: "https://doi.org/10.5281/zenodo.42",
          links: { record_html: "https://zenodo.org/records/42" },
        }),
      );

    const deposit = await publishZenodoDeposit("42");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://zenodo.org/api/deposit/depositions/42/actions/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://zenodo.org/api/deposit/depositions/42",
      expect.objectContaining({ method: "GET" }),
    );
    expect(deposit.doi).toBe("10.5281/zenodo.42");
    expect(deposit.recordUrl).toBe("https://zenodo.org/records/42");
  });

  it("lists attached files so a resume does not upload twice", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 42,
        state: "inprogress",
        files: [{ filename: "paper.pdf" }, {}],
      }),
    );

    await expect(getZenodoDeposit("42")).resolves.toMatchObject({
      fileNames: ["paper.pdf"],
    });
  });

  it("surfaces a rejected request without including the token", async () => {
    fetchMock.mockResolvedValue(new Response("quota exceeded", { status: 403 }));

    await expect(createZenodoDeposit()).rejects.toThrow(
      "Zenodo returned 403: quota exceeded.",
    );
    await expect(createZenodoDeposit()).rejects.not.toThrow("test-token");
  });
});

describe("pure normalisers", () => {
  it("stores a DOI bare", () => {
    expect(normalizeDoi("https://doi.org/10.5281/zenodo.1")).toBe("10.5281/zenodo.1");
    expect(normalizeDoi("http://dx.doi.org/10.5072/zenodo.2")).toBe("10.5072/zenodo.2");
    expect(normalizeDoi("  ")).toBeNull();
  });

  it("keeps a readable PDF filename", () => {
    expect(zenodoFileName("My Paper (final).pdf", "manuscript-1")).toBe(
      "My-Paper-final.pdf",
    );
    expect(zenodoFileName("", "manuscript-1")).toBe("manuscript-1.pdf");
    expect(zenodoFileName(null, "manuscript-1")).toBe("manuscript-1.pdf");
  });
});
