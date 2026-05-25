/**
 * Retries a database operation that may fail with transient connection errors.
 *
 * Vercel serverless functions occasionally fail their FIRST Prisma query with
 * `P1001 — Can't reach database server` when the underlying MySQL host (a shared
 * Turkish provider with limited concurrent connections) takes too long to
 * accept the new TCP connection. The second attempt almost always succeeds
 * because the connection pool is warm.
 *
 * Retries with short exponential backoff (50ms, 200ms, 500ms) — these are
 * synchronous-ish delays so they fit within Discord's 3-second deadline when
 * called from interaction handlers that are already running in fire-and-forget
 * mode after a deferred response.
 *
 * Usage:
 *   const user = await withDbRetry(() => prisma.user.findUnique({ ... }));
 */
const TRANSIENT_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
]);

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string })?.code;
      const isTransient = code && TRANSIENT_CODES.has(code);

      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }

      // Exponential backoff: 50ms, 200ms, 500ms
      const delay = attempt === 1 ? 50 : attempt === 2 ? 200 : 500;
      console.warn(
        `[db-retry] ${code} on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
