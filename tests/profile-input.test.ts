import { describe, expect, it } from 'vitest';
import { parseProfileInput } from '../src/lib/steam/profileInput';

const ID = '76561198000000000';

describe('parseProfileInput', () => {
  it('accepts a raw SteamID64', () => {
    expect(parseProfileInput(ID)).toEqual({ kind: 'steamid', steamId: ID });
    expect(parseProfileInput(`  ${ID}  `)).toEqual({ kind: 'steamid', steamId: ID });
  });

  it('accepts /profiles/<id> URLs, with or without scheme', () => {
    const expected = { kind: 'steamid', steamId: ID };
    expect(parseProfileInput(`https://steamcommunity.com/profiles/${ID}`)).toEqual(expected);
    expect(parseProfileInput(`https://steamcommunity.com/profiles/${ID}/`)).toEqual(expected);
    expect(parseProfileInput(`steamcommunity.com/profiles/${ID}`)).toEqual(expected);
  });

  it('accepts /id/<vanity> URLs and leaves resolution to the caller', () => {
    expect(parseProfileInput('https://steamcommunity.com/id/gaben')).toEqual({ kind: 'vanity', vanity: 'gaben' });
    expect(parseProfileInput('/id/gaben')).toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('rejects malformed ids, other hosts and non-profile paths', () => {
    expect(parseProfileInput('')).toBeNull();
    expect(parseProfileInput('1234')).toBeNull();
    expect(parseProfileInput('https://steamcommunity.com/profiles/abc')).toBeNull();
    expect(parseProfileInput('https://steamcommunity.com/app/730')).toBeNull();
    expect(parseProfileInput(`https://example.com/profiles/${ID}`)).toBeNull();
  });

  it('rejects look-alike hosts', () => {
    expect(parseProfileInput(`https://evilsteamcommunity.com/profiles/${ID}`)).toBeNull();
    expect(parseProfileInput(`evilsteamcommunity.com/profiles/${ID}`)).toBeNull();
  });
});
