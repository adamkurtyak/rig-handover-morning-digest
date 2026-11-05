import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const tempDirs: string[] = [];

function makeRunsDir(): string {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  tempDirs.push(runsDir);
  return runsDir;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function event(job: string, status: 'ok' | 'retry' | 'fail' = 'ok'): string {
  return JSON.stringify({
    at: '2026-10-28T06:00:00+01:00',
    job,
    status,
    owner: 'rook',
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('digest routes', () => {
  it('returns 200 and presents the same sorted jobs in HTML and JSON', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [event('zeta'), event('alpha')].join('\n'));
    const app = appFor(runsDir);

    const pageResponse = await app.request('/digest/2026-10-28');
    const apiResponse = await app.request('/api/digest/2026-10-28');
    const html = await pageResponse.text();
    const rows = await apiResponse.json() as Array<{ job: string }>;

    expect(pageResponse.status).toBe(200);
    expect(apiResponse.status).toBe(200);
    expect(rows.map((row) => row.job)).toEqual(['alpha', 'zeta']);
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('zeta'));
  });

  it('returns 404 from both routes for a missing night', async () => {
    const app = appFor(makeRunsDir());

    const pageResponse = await app.request('/digest/2099-01-01');
    const apiResponse = await app.request('/api/digest/2099-01-01');

    expect(pageResponse.status).toBe(404);
    expect(apiResponse.status).toBe(404);
  });

  it('renders an empty night and returns an empty JSON list', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');
    const app = appFor(runsDir);

    const pageResponse = await app.request('/digest/2026-10-28');
    const apiResponse = await app.request('/api/digest/2026-10-28');

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('nothing ran');
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toEqual([]);
  });

  it('counts a malformed line without dropping valid jobs', async () => {
    const runsDir = makeRunsDir();
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), [event('kept'), '{not json'].join('\n'));
    const app = appFor(runsDir);

    const pageResponse = await app.request('/digest/2026-10-28');
    const apiResponse = await app.request('/api/digest/2026-10-28');

    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('1 bad line ignored');
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toMatchObject([{ job: 'kept' }]);
  });
});
