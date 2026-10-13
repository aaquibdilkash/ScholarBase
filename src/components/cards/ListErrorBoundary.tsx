"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Client-side error boundary for list regions.
 *
 * Wraps the <Suspense> + <AsyncList> tree inside AsyncListRegion so that any
 * unhandled exception thrown by a fetcher (e.g. a Prisma error, a network
 * failure, or a rejected `use()` promise) is caught here rather than
 * propagating to the page level and triggering the generic Next.js production
 * "Server Components render failed" 500.
 */
export class ListErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the error to the console so it appears in server/edge logs and
    // Sentry's server-side SDK picks it up with full context.
    console.error("[ListErrorBoundary] caught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
          <p className="mb-2 font-medium">Failed to load content.</p>
          <p>Please refresh the page to try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
