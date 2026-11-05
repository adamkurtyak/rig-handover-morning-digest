import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { sortDigestRows } from './digest/order.js';
import { readNight } from './digest/read-night.js';
import type { ReadNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createApp(config: RigConfig = loadConfig(), readDigest: ReadNight = readNight) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    try {
      const digest = readDigest(config.runsDir, c.req.param('night'));
      return c.json(sortDigestRows(digest.rows));
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        return c.json({ error: 'night not found' }, 404);
      }
      throw error;
    }
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    try {
      const digest = readDigest(config.runsDir, c.req.param('night'));
      const sorted = { ...digest, rows: sortDigestRows(digest.rows) };

      return c.html(
        <Layout title={`digest · ${c.req.param('night')}`} lane={lane()}>
          <DigestPage digest={sorted} night={c.req.param('night')} />
        </Layout>,
      );
    } catch (error) {
      if (isMissingFile(error)) return c.notFound();
      throw error;
    }
  });

  return app;
}
