import { describe, it, expect } from 'vitest';
import { shortenSha, formatTimestamp, pluralize, tzOffsetToMinutes, formatIdentTime } from './format';

describe('shortenSha', () => {
  const full = '1e4f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f';

  it('defaults to 7 chars', () => {
    expect(shortenSha(full)).toBe('1e4f9a2');
  });

  it('respects a custom length', () => {
    expect(shortenSha(full, 12)).toBe('1e4f9a2b3c4d');
  });

  it('clamps len below 1 to 1', () => {
    expect(shortenSha(full, 0)).toBe('1');
    expect(shortenSha(full, -5)).toBe('1');
  });

  it('never exceeds the input length', () => {
    expect(shortenSha('abc', 7)).toBe('abc');
  });

  it('trims whitespace and handles empty input', () => {
    expect(shortenSha('  deadbeef  ')).toBe('deadbee');
    expect(shortenSha('')).toBe('');
    expect(shortenSha('   ')).toBe('');
  });
});

describe('formatTimestamp', () => {
  // 2021-01-01 00:00:00 UTC
  const t = 1609459200;

  it('formats UTC with zero offset', () => {
    expect(formatTimestamp(t, 0)).toBe('2021-01-01 00:00:00 +0000');
  });

  it('applies a positive (east) offset as wall-clock', () => {
    // +330 min = +05:30 → 05:30 local
    expect(formatTimestamp(t, 330)).toBe('2021-01-01 05:30:00 +0530');
  });

  it('applies a negative (west) offset', () => {
    // -480 min = -08:00 → previous day 16:00
    expect(formatTimestamp(t, -480)).toBe('2020-12-31 16:00:00 -0800');
  });

  it('returns empty string for non-finite input', () => {
    expect(formatTimestamp(NaN)).toBe('');
    expect(formatTimestamp(Infinity)).toBe('');
  });
});

describe('tzOffsetToMinutes', () => {
  it('parses signed 4-digit git offsets', () => {
    expect(tzOffsetToMinutes('+0000')).toBe(0);
    expect(tzOffsetToMinutes('+0530')).toBe(330);
    expect(tzOffsetToMinutes('-0800')).toBe(-480);
  });
  it('returns 0 for malformed input', () => {
    expect(tzOffsetToMinutes('nonsense')).toBe(0);
  });
});

describe('formatIdentTime', () => {
  it('formats a commit timestamp in its recorded zone', () => {
    // 2021-01-01 00:00:00 UTC in +0530
    expect(formatIdentTime(1609459200, '+0530')).toBe('2021-01-01 05:30:00 +0530');
  });
});

describe('pluralize', () => {
  it('uses singular for exactly 1', () => {
    expect(pluralize(1, 'commit')).toBe('1 commit');
  });

  it('uses plural for 0 and >1', () => {
    expect(pluralize(0, 'commit')).toBe('0 commits');
    expect(pluralize(3, 'branch', 'branches')).toBe('3 branches');
  });

  it('treats -1 as singular', () => {
    expect(pluralize(-1, 'file')).toBe('-1 file');
  });
});
