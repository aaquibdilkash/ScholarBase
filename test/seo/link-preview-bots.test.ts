/**
 * Link-preview crawler contract.
 *
 * Telegram and WhatsApp were unfurling the same post URL differently: WhatsApp
 * showed the post's own title/image, Telegram showed the root layout's generic
 * "Research Feed" title and logo. Next.js streams metadata for bots that are
 * not in `htmlLimitedBots`, and Telegram is not in the default list. Blocking
 * metadata for Telegram makes it see the same OG tags the page actually
 * generated.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const bots = nextConfig.htmlLimitedBots as RegExp;

describe("link-preview metadata", () => {
  it("serves blocking metadata to Telegram", () => {
    expect(bots).toBeInstanceOf(RegExp);
    expect(bots.test("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("keeps the default blocking list for WhatsApp and other unfurlers", () => {
    expect(bots.test("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(bots.test("facebookexternalhit/1.1")).toBe(true);
    expect(bots.test("Twitterbot/1.0")).toBe(true);
  });

  it("leaves normal browsers on streamed metadata", () => {
    expect(
      bots.test(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });
});
