import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function configWithRuns(runsDir: string) {
  return {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
}

function makeRunsDir(): string {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  tempDirs.push(runsDir);
  return runsDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('digest JSON API', () => {
  it('returns rows sorted by job', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(
      join(runsDir, '2026-10-28.jsonl'),
      [
        JSON.stringify({ at: '2026-10-28T06:02:00+01:00', job: 'zeta', status: 'ok', owner: 'Zed' }),
        JSON.stringify({ at: '2026-10-28T06:01:00+01:00', job: 'alpha', status: 'retry', owner: null }),
      ].join('\n'),
    );

    const response = await createApp(configWithRuns(runsDir)).request('/api/digest/2026-10-28');

    expect(response.status).toBe(200);
    const rows = await response.json() as Array<{ job: string }>;
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
  });

  it('returns 404 when the night file is missing', async () => {
    const runsDir = makeRunsDir();

    const response = await createApp(configWithRuns(runsDir)).request('/api/digest/2099-01-01');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'night not found' });
  });
});
