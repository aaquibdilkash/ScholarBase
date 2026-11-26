import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const shellPath = fileURLToPath(
  new URL("../../src/components/cards/DetailPageCardShell.tsx", import.meta.url),
);
const shellSource = readFileSync(shellPath, "utf8");

describe("DetailPageCardShell responsive related content", () => {
  it("keeps the related rail below the card until the wide layout breakpoint", () => {
    expect(shellSource).toContain("2xl:grid 2xl:grid-cols-[minmax(0,44rem)_minmax(0,1fr)]");
    expect(shellSource).toContain('className="mt-6 2xl:hidden"');
    expect(shellSource).toContain('className="hidden 2xl:sticky 2xl:top-6 2xl:block"');
    expect(shellSource).not.toContain("xl:grid xl:grid-cols-[minmax(0,44rem)_minmax(0,1fr)]");
  });
});
