import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describeError, redirectToLogin, shouldRetry, toastError } from "@/lib/error-report";

/**
 * Shared React Query setup for both tRPC clients:
 * - a failed *query* (page data) surfaces as a toast instead of the page
 *   silently showing "Kayıt yok"; mutations already toast at the call site
 *   (toastError) so they're left alone here,
 * - an expired session sends the user to sign in,
 * - only network hiccups are retried — a 4xx won't fix itself.
 * Pass `meta: { silent: true }` on a query to handle its error yourself (used
 * by background pollers like the notification bells — they just retry).
 * Repeated failures of one query share a toast id, so polling can't stack them.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        const info = describeError(err);
        if (info.kind === "auth") {
          redirectToLogin();
          return;
        }
        if (query.meta?.silent) return;
        // Background refetch failures of data already on screen stay quiet.
        if (query.state.data !== undefined && info.kind === "network") return;
        toastError(err, undefined, { id: `query:${query.queryHash}` });
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
