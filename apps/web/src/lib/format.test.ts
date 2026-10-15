import { describe, expect, it } from 'vitest';
import { formatBytes, formatCount, formatDuration, timeAgo } from './format';

describe('format', () => {
  it('formats counts compactly with the right noun', () => {
    expect(formatCount(1, 'view')).toBe('1 view');
    expect(formatCount(0, 'view')).toBe('0 views');
    expect(formatCount(1234, 'view')).toBe('1.2K views');
  });

  it('formats durations', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('formats relative times', () => {
    const now = new Date('2026-10-15T12:00:00Z');
    expect(timeAgo('2026-10-15T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-10-15T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-14T12:00:00Z', now)).toBe('yesterday');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
  });
});
