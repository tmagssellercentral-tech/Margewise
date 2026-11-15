/**
 * The nightly sync accepts only `Authorization: Bearer $CRON_SECRET`, which Vercel Cron sends.
 * There is no query-string key: secrets in URLs end up in browser history and logs.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
