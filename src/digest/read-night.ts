import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Digest, DigestRow, DigestStatus, ReadNight } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DigestStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function parseRunEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (
    !isRecord(value)
    || typeof value.at !== 'string'
    || typeof value.job !== 'string'
    || !isStatus(value.status)
    || !(typeof value.owner === 'string' || value.owner === null)
    || !(value.error === undefined || typeof value.error === 'string')
  ) {
    return null;
  }

  return {
    at: value.at,
    job: value.job,
    status: value.status,
    owner: value.owner,
    ...(value.error === undefined ? {} : { error: value.error }),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;

    const event = parseRunEvent(line);
    if (event === null) {
      badLines += 1;
      continue;
    }

    const row = rows.get(event.job);
    if (row === undefined) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
      continue;
    }

    row.owner = event.owner;
    row.runs += 1;
    if (event.status === 'retry') row.retries += 1;
    row.lastStatus = event.status;
    if (event.error !== undefined) row.lastError = event.error;
    row.lastAt = event.at;
  }

  return { rows: [...rows.values()], badLines } satisfies Digest;
};
