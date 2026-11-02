/** Cron and backfill endpoints accept only `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this). */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
