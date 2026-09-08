## What changed

<!-- One paragraph. What a reviewer needs to know before reading the diff. -->

## Which acceptance gate this satisfies

<!-- e.g. "Phase 5 gate: test_reliability.py reproduces the paper's table." -->

## Deliberately left out

<!-- Scope that was cut, and why. Cutting scope is fine; cutting the standards is not. -->

## LEARNING_NOTES entry added

<!-- The pattern, why it was used here, the alternative rejected, and the interview
     question it answers. Paste the entry or link the line. -->

## Checklist

- [ ] `npm run verify` is green (format, lint, typecheck, tests, gates 1/2/3/5, secret scan)
- [ ] `apps/brain` tests pass, including GATE 4
- [ ] Every new module matches the reference module layout (`apps/api/src/modules/auth/`)
- [ ] Every new module has its own `README.md`
- [ ] `docs/LEARNING_NOTES.md` extended
- [ ] `docs/CODE_TOUR.md` still covers the system as it now stands
- [ ] No new numeric field lacks a `Quantity` envelope
- [ ] No new outbound HTTP call outside `packages/connectors`
