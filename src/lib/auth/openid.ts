const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const STEAM_IDENTIFIER_PREFIX = 'http://steamcommunity.com/openid/id/';

export interface SteamOpenIdParams {
  realm: string;
  returnTo: string;
}

/**
 * Build the Steam OpenID login URL (OpenID 2.0 checkid_setup).
 * Redirect the user's browser here; Steam will bounce them back to `returnTo`
 * with the signed assertion params.
 */
export function buildLoginUrl({ realm, returnTo }: SteamOpenIdParams): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${OPENID_ENDPOINT}?${params.toString()}`;
}

/**
 * Verify the OpenID assertion returned by Steam and extract the 64-bit SteamID.
 * Re-posts the params back to Steam with mode=check_authentication.
 */
export async function verifyOpenIdResponse(
  returnTo: string,
  params: URLSearchParams,
): Promise<string | null> {
  // nonce anti-replay: bail if absent
  if (!params.get('openid.claimed_id') || !params.get('openid.nonce')) {
    return null;
  }

  const validation = new URLSearchParams({
    'openid.assoc_handle': params.get('openid.assoc_handle') ?? '',
    'openid.signed': params.get('openid.signed') ?? '',
    'openid.sig': params.get('openid.sig') ?? '',
    'openid.mode': 'check_authentication',
    'openid.ns': params.get('openid.ns') ?? OPENID_NS,
    'openid.op_endpoint': params.get('openid.op_endpoint') ?? '',
    'openid.claimed_id': params.get('openid.claimed_id') ?? '',
    'openid.identity': params.get('openid.identity') ?? '',
    'openid.return_to': params.get('openid.return_to') ?? returnTo,
    'openid.response_nonce': params.get('openid.response_nonce') ?? '',
  });

  if (validation.get('openid.return_to') !== returnTo) {
    return null;
  }

  const res = await fetch(OPENID_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: validation.toString(),
  });

  if (!res.ok) return null;
  const body = await res.text();
  if (!/is_valid:true/.test(body)) return null;

  const claimedId = params.get('openid.claimed_id') ?? '';
  if (!claimedId.startsWith(STEAM_IDENTIFIER_PREFIX)) return null;
  return claimedId.slice(STEAM_IDENTIFIER_PREFIX.length);
}
