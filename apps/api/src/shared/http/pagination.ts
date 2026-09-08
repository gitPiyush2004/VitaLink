/**
 * Cursor pagination, implemented once (PART 3A.6).
 *
 * Why cursors and not `?page=3&limit=50`: offset pagination re-runs the query and
 * skips N rows, so when the collection is being written to — and `signals` is
 * being written to constantly — page 2 can repeat or omit rows that page 1 saw.
 * A cursor is a position in a stable sort, so it does not have that problem.
 *
 * The cursor is an opaque base64url string. Opaque matters: if clients start
 * parsing it, we can never change what it contains.
 */

import type { PageMeta } from '@vitalink/contracts';

import { MAX_PAGE_SIZE } from '@config/constants';

/**
 * The sort position a cursor encodes. `createdAt` alone is not unique, so `id` is
 * the tie-breaker — without it, two documents written in the same millisecond can
 * straddle a page boundary and one gets lost.
 */
export type Cursor = {
  createdAt: string;
  id: string;
};

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

/** Returns null for a malformed cursor rather than throwing: treat it as "start again". */
export function decodeCursor(raw: string): Cursor | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      'createdAt' in decoded &&
      'id' in decoded &&
      typeof decoded.createdAt === 'string' &&
      typeof decoded.id === 'string'
    ) {
      return { createdAt: decoded.createdAt, id: decoded.id };
    }
    return null;
  } catch {
    return null;
  }
}

export type Paginated<T> = { items: T[]; page: PageMeta };

/**
 * Turns a repository result into a page.
 *
 * The repository is asked for `limit + 1` rows. If it returns that many, there is
 * at least one more page, and the extra row is dropped rather than shown. This
 * avoids a second `countDocuments()` query purely to answer "is there more?".
 */
export function buildPage<T extends { createdAt: string; id: string }>(
  rows: T[],
  limit: number,
): Paginated<T> {
  const effectiveLimit = Math.min(limit, MAX_PAGE_SIZE);
  const hasMore = rows.length > effectiveLimit;
  const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const last = items.at(-1);

  return {
    items,
    page: {
      next_cursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
      has_more: hasMore,
      count: items.length,
    },
  };
}
