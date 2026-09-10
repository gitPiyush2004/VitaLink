/**
 * The one data-fetching hook every view uses.
 *
 * `@tanstack/react-query` is a dependency of this workspace and is deliberately
 * unused. Every view here loads once and reloads on an explicit button — there
 * is no background refetch, no cache invalidation graph, and no optimistic
 * update to coordinate. React Query would be a layer to explain rather than a
 * problem solved. When live updates arrive over the socket, it earns its place.
 *
 * ## An error is rendered, never swallowed
 *
 * The hook returns `error` as a string rather than throwing into a boundary,
 * because the errors this UI produces are *informative*: "no eligible carrier",
 * "the cascade reaches no drug", "GDELT returned 429". Those are findings the
 * operator should read, not crashes to hide behind a generic panel.
 */

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../api/client';

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  // `load` is a closure the caller rebuilds on every render, so it can never be
  // a stable dependency; `deps` is what the load actually depends on. That is
  // the same contract `useCallback` has, and it is the caller's job to pass the
  // right `deps` — which is why every call site here passes a literal array.
  //
  // `eslint-plugin-react-hooks` would flag this and is deliberately not
  // installed: it is the one rule that would need to be silenced in the one
  // place the pattern is correct, and a plugin whose only effect is a suppressed
  // warning is worse than no plugin.
  const run = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void run()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(describe(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Guards against a state write after the view has moved on, which React
    // reports as a warning and which would show one tab's error on another.
    return () => {
      cancelled = true;
    };
  }, [run, nonce]);

  const reload = useCallback(() => {
    setNonce((current) => current + 1);
  }, []);

  return { data, error, loading, reload };
}

/**
 * An action that reports what happened rather than just succeeding.
 *
 * Used for the loop's four commands — ingest, verify, cascade, recommend — each
 * of which produces a *report*: how many sources answered, how many clusters
 * were quarantined and why. Throwing that away and refetching a list would
 * discard the most interesting output.
 */
export function useAction<T>(): {
  result: T | null;
  error: string | null;
  busy: boolean;
  run: (action: () => Promise<T>) => void;
  clear: () => void;
} {
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback((action: () => Promise<T>) => {
    setBusy(true);
    setError(null);

    void action()
      .then((next) => {
        setResult(next);
      })
      .catch((cause: unknown) => {
        setError(describe(cause));
      })
      .finally(() => {
        setBusy(false);
      });
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, busy, run, clear };
}

/**
 * The message a reader should see.
 *
 * An `ApiError` already carries a sentence written for a human — the API's
 * errors say things like "the shock reaches no drug in the current graph, which
 * may be correct" — so it is passed through rather than replaced.
 */
function describe(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return 'Something failed and gave no message, which is itself worth reporting.';
}
