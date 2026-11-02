/**
 * Cron and backfill endpoints accept `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this).
 * Backfill also accepts `?key=$CRON_SECRET` so it can be triggered from a browser by the owner.
 */
export function cronAuthorized(req: Request, allowQueryKey = false): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return allowQueryKey && new URL(req.url).searchParams.get("key") === secret;
}
