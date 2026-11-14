/**
 * Link-preview crawler contract.
 *
 * Telegram and WhatsApp were unfurling the same post URL differently: WhatsApp
 * showed the post's own title/image, Telegram showed the root layout's generic
 * "Research Feed" title and logo. Next.js streams metadata for bots that are
 * not in `htmlLimitedBots`, and Telegram is not in the default list. Blocking
 * metadata for Telegram makes it see the same OG tags the page actually
 * generated.
 *
 * The same mechanism covers the AI answer engines. They are absent from Next's
 * default list, so they were receiving streamed metadata that arrives after the
 * body — and they read the initial `<head>` only. That made the canonical and
 * OG tags invisible to the crawlers that generate AI answers, which is a
 * silent failure: the page renders perfectly and simply never gets cited.
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

describe("AI crawler metadata", () => {
  // Real production user-agent strings. If one of these stops matching, that
  // engine silently falls back to streamed metadata and loses the canonical.
  it.each([
    [
      "GPTBot",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
    ],
    [
      "ChatGPT-User",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
    ],
    [
      "OAI-SearchBot",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
    ],
    [
      "ClaudeBot",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    ],
    [
      "anthropic-ai",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; anthropic-ai)",
    ],
    [
      "PerplexityBot",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    ],
    ["CCBot", "CCBot/2.0 (https://commoncrawl.org/faq/)"],
    [
      "Amazonbot",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 Amazonbot/0.1",
    ],
    [
      "meta-externalagent",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    ],
    [
      "Bytespider",
      "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
    ],
  ])("serves blocking metadata to %s", (_name, userAgent) => {
    expect(bots.test(String(userAgent))).toBe(true);
  });

  it("covers Google-Extended through the existing Google pattern", () => {
    expect(bots.test("Mozilla/5.0 (compatible; Google-Extended/1.0)")).toBe(true);
  });
});
