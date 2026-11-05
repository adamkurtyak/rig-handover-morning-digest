import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

describe('readNight', () => {
  it('aggregates the sample night and counts its malformed line', () => {
    const digest = readNight('runs', '2026-10-28');

    expect(digest.badLines).toBe(1);
    expect(digest.rows).toHaveLength(5);
    expect(digest.rows.find((row) => row.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest.rows.find((row) => row.job === 'digest/render')?.owner).toBeNull();
  });

  it('keeps an empty night empty', () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');

    expect(readNight(runsDir, '2026-10-30')).toEqual({ rows: [], badLines: 0 });
  });
});
