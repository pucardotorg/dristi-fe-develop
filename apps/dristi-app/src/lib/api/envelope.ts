/**
 * The backend's response envelope, and how to take it off.
 *
 * Every JSON response passes through the backend's `MetaJSONRenderer`
 * (dristi-be `src/apps/api/renderers.py`), which adds response metadata:
 *   - an object gets a `meta` key beside its own fields:  { id, name, ..., meta }
 *   - a list or a scalar is wrapped:                       { data: [...], meta }
 *   - a paginated list is an object, so it keeps its keys: { count, next, previous, results, meta }
 *
 * `unwrapEnvelope` returns what the endpoint is actually about, with `meta` beside it.
 *
 * Known ambiguity, inherited from the renderer: an object whose only own field is `data`
 * looks like a wrapped list. No endpoint returns that shape today.
 */

/** What the backend attaches to every response. */
export type ResponseMeta = {
  /** Server time, ISO 8601 in IST. */
  timestamp: string;
  /** Backend build (git SHA). Useful in bug reports. */
  app_version: string;
  spec_version: string;
};

/** DRF page-number pagination: `?page=N`, 20 rows per page by default. */
export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMeta(value: unknown): value is ResponseMeta {
  return isRecord(value) && typeof value.timestamp === "string";
}

export function unwrapEnvelope(body: unknown): { data: unknown; meta: ResponseMeta | null } {
  if (!isRecord(body) || !("meta" in body)) return { data: body, meta: null };

  const { meta, ...rest } = body;
  const keys = Object.keys(rest);
  const data = keys.length === 1 && keys[0] === "data" ? rest.data : rest;
  return { data, meta: isMeta(meta) ? meta : null };
}
