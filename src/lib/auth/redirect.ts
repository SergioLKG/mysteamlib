/** Post-login destinations the app is willing to redirect to. */
export const ALLOWED_NEXT = ['/dashboard', '/platino'] as const;

/**
 * Returns `value` only if it is an allowlisted internal path, otherwise `null`.
 * Used on both login (before it goes into `return_to`) and callback (before
 * redirecting), since the callback query string is attacker-controllable.
 */
export function safeNext(value: string | null | undefined): string | null {
  return (ALLOWED_NEXT as readonly string[]).includes(value ?? '') ? (value as string) : null;
}
