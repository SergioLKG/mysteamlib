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

  it('accepts a bare custom name as a vanity', () => {
    expect(parseProfileInput('gaben')).toEqual({ kind: 'vanity', vanity: 'gaben' });
    expect(parseProfileInput('  mi_nick-2 ')).toEqual({ kind: 'vanity', vanity: 'mi_nick-2' });
  });

  it('rejects names Steam cannot have as a custom URL', () => {
    expect(parseProfileInput('ab')).toBeNull();
    expect(parseProfileInput('con espacios')).toBeNull();
    expect(parseProfileInput('a'.repeat(33))).toBeNull();
    expect(parseProfileInput('https://steamcommunity.com/id/a%20b')).toBeNull();
  });

  it('rejects digit-only input that is not a 17-digit SteamID', () => {
    expect(parseProfileInput('123')).toBeNull();
    expect(parseProfileInput('7656119800000000')).toBeNull();
    expect(parseProfileInput('765611980000000000')).toBeNull();
  });

  it('accepts /id/<vanity>/ with a trailing slash', () => {
    expect(parseProfileInput('https://steamcommunity.com/id/gaben/')).toEqual({ kind: 'vanity', vanity: 'gaben' });
  });

  it('rejects malformed ids, other hosts and non-profile paths', () => {
    expect(parseProfileInput('')).toBeNull();
    expect(parseProfileInput('https://steamcommunity.com/profiles/abc')).toBeNull();
    expect(parseProfileInput('https://steamcommunity.com/app/730')).toBeNull();
    expect(parseProfileInput(`https://example.com/profiles/${ID}`)).toBeNull();
  });

  it('rejects look-alike hosts', () => {
    expect(parseProfileInput(`https://evilsteamcommunity.com/profiles/${ID}`)).toBeNull();
    expect(parseProfileInput(`evilsteamcommunity.com/profiles/${ID}`)).toBeNull();
  });
});
