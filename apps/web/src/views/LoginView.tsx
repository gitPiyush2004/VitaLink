/**
 * Sign in.
 *
 * The password is held in component state only until the request resolves, and
 * then discarded. It is never put in a URL, never logged, and never stored — the
 * access token that comes back lives in a module variable in `api/client.ts`
 * rather than in localStorage, because localStorage is readable by any script on
 * the page.
 *
 * The left half is not decoration. It states the one property that makes this
 * system different from a dashboard that would look identical: that it refuses
 * to display a number it cannot source. Someone seeing the product for the first
 * time should meet that claim before they meet the data, because otherwise the
 * empty cells later read as missing features rather than as the point.
 */

import { useState } from 'react';

import { Button, ErrorNote, TextField } from '@vitalink/ui';

import { ApiError, login } from '../api/client';

const FACTS = [
  {
    lead: 'Watch regulatory events.',
    rest: 'Published FDA shortages, resolutions, planned discontinuations and recalls, with source dates, lots and availability.',
  },
  {
    lead: 'Investigate medicine exposure.',
    rest: 'Connect evidence to product identifiers, ingredients and labelers. See the limits of each relationship.',
  },
  {
    lead: 'Record an informed response.',
    rest: 'Compare listed products, inspect source history, record the next investigation action and export a traceable report.',
  },
];

export function LoginView({ onSignedIn }: { onSignedIn: () => void }): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(): void {
    setBusy(true);
    setError(null);

    void login(email, password)
      .then(() => {
        // Cleared before the view unmounts, so it is not sitting in a detached
        // fibre waiting for the garbage collector.
        setPassword('');
        onSignedIn();
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Unable to connect. Please try again or contact your administrator.',
        );
        setBusy(false);
      });
  }

  return (
    <div className="vl-login op-login">
      <section className="vl-login-brand">
        <div className="vl-row" style={{ gap: 12 }}>
          <span className="vl-brand-mark" aria-hidden="true">
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 12.5h4l2.2-5.5 3.6 11 2.4-6.5h6.8" />
            </svg>
          </span>
          <span style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--vl-ink)' }}>
            Vitalink
          </span>
        </div>

        <h1>See the disruption. Protect the supply.</h1>

        <p>
          A medicine supply investigation workspace for procurement and supply-chain analysts.
          Follow real regulatory evidence from first signal to a recorded response decision.
        </p>

        <ul className="vl-login-facts">
          {FACTS.map((fact) => (
            <li key={fact.lead}>
              <span className="vl-login-tick" aria-hidden="true">
                ✓
              </span>
              <span>
                <b>{fact.lead}</b> {fact.rest}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="vl-login-form">
        <form
          className="vl-login-form-inner"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--vl-ink)', fontWeight: 620 }}>
              Sign in
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--vl-ink-3)' }}>
              Operator access to the control tower.
            </p>
          </div>

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          {error === null ? null : <ErrorNote text={error} />}

          <Button
            onClick={submit}
            variant="primary"
            busy={busy}
            disabled={email === '' || password === ''}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--vl-ink-3)', lineHeight: 1.6 }}>
            Access is managed by your organisation administrator. Public regulatory evidence is kept
            separate from your organisation’s investigation records.
          </p>
        </form>
      </section>
    </div>
  );
}
