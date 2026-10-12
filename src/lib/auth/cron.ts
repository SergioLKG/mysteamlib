/**
 * Authorizes a Vercel cron request (`Authorization: Bearer $CRON_SECRET`).
 * Fails closed in production when the secret is missing; in dev/test an unset
 * secret allows the call so the endpoints can be hit by hand.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (import.meta.env.PROD) {
      console.error('CRON_SECRET is not set: rejecting cron request');
      return false;
    }
    return true;
  }
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
