/**
 * Shared Cloudflare Turnstile widget typing.
 *
 * Lives here so the two widgets (institution domain request, contact form)
 * cannot drift apart or each declare their own `Window.turnstile` global —
 * two modules declaring the same global with nominally different types is a
 * TypeScript error, and two widget option shapes is a silent bug.
 */

export type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  size: "flexible";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

export type TurnstileWidget = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}
