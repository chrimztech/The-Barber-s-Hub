/**
 * Central place to report errors caught by React error boundaries.
 * Logs to the console for now; hook a monitoring service (e.g. Sentry) in here later.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[app] unhandled error", {
    route: window.location.pathname,
    ...context,
    error,
  });
}
