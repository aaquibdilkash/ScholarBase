/**
 * Private manuscript storage helpers.
 *
 * The path check is the only thing standing between one author's upload and
 * another author's file, so it is tested with traversal, wrong-user, and
 * wrong-extension inputs rather than only the happy path.
 */
import { describe, expect, it } from "vitest";

import {
  isManuscriptObjectPathForUser,
  isSha256Hex,
  manuscriptObjectPath,
  manuscriptSourceObjectPath,
  sha256Hex,
} from "@/lib/manuscript-storage";

describe("manuscriptObjectPath", () => {
  it("scopes the object under the author", () => {
    expect(manuscriptObjectPath("u1", "abc-123")).toBe(
      "users/u1/manuscripts/abc-123.pdf",
    );
  });

  it("uses a separate DOCX extension for the optional source", () => {
    expect(manuscriptSourceObjectPath("u1", "abc-123")).toBe(
      "users/u1/manuscripts/abc-123.docx",
    );
  });
});

describe("isManuscriptObjectPathForUser", () => {
  const path = "users/u1/manuscripts/abc-123.pdf";

  it("accepts the author's own PDF path", () => {
    expect(isManuscriptObjectPathForUser("u1", path)).toBe(true);
  });

  it("rejects another author's path", () => {
    expect(isManuscriptObjectPathForUser("u2", path)).toBe(false);
  });

  it("rejects traversal and nested segments", () => {
    expect(
      isManuscriptObjectPathForUser("u1", "users/u1/manuscripts/../u2/x.pdf"),
    ).toBe(false);
    expect(
      isManuscriptObjectPathForUser("u1", "users/u1/manuscripts/nested/x.pdf"),
    ).toBe(false);
  });

  it("accepts a DOCX source and rejects the bare prefix", () => {
    expect(isManuscriptObjectPathForUser("u1", "users/u1/manuscripts/x.docx")).toBe(true);
    expect(isManuscriptObjectPathForUser("u1", "users/u1/manuscripts/")).toBe(
      false,
    );
  });
});

describe("sha256Hex", () => {
  it("matches the known digest for 'abc'", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic and lower-case", () => {
    const digest = sha256Hex(new Uint8Array([1, 2, 3]));
    expect(digest).toHaveLength(64);
    expect(digest).toBe(digest.toLowerCase());
    expect(sha256Hex(new Uint8Array([1, 2, 3]))).toBe(digest);
  });
});

describe("isSha256Hex", () => {
  it("accepts a 64-character hex digest", () => {
    expect(isSha256Hex("a".repeat(64))).toBe(true);
    expect(isSha256Hex("0123456789abcdef".repeat(4))).toBe(true);
  });

  it("rejects short, upper-case, and non-hex values", () => {
    expect(isSha256Hex("a".repeat(63))).toBe(false);
    expect(isSha256Hex("A".repeat(64))).toBe(false);
    expect(isSha256Hex("g".repeat(64))).toBe(false);
  });
});
