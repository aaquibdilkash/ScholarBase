import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const errorBoundary = readFileSync("src/app/error.tsx", "utf8");
const globalErrorBoundary = readFileSync("src/app/global-error.tsx", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

describe("error boundary retry action", () => {
  it("uses the theme-safe retry class in both boundaries", () => {
    expect(errorBoundary).toContain('className="sb-error-retry-button');
    expect(globalErrorBoundary).toContain('className="sb-error-retry-button');
  });

  it("defines readable light and dark colors without variant utility rewrites", () => {
    expect(styles).toContain(".sb-error-retry-button {");
    expect(styles).toContain("html.dark .sb-error-retry-button");
    expect(errorBoundary).not.toContain("dark:bg-white");
    expect(globalErrorBoundary).not.toContain("bg-white");
  });
});
