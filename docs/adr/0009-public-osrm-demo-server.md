# ADR-0009: Routing uses the public OSRM demo server

- Status: accepted, with a stated limitation
- Date: 2026-09-08

## Context

Lane distances, road transit durations and lane geometry are needed for the
physical layer of the graph and for the logistics risk sub-score — the geometry is
what the temperature forecast is sampled along.

## Options considered

**Public OSRM demo server** (`router.project-osrm.org`). Free, no key, works
immediately. Its fair-use terms explicitly make it unsuitable for production
volume.

**Self-hosted OSRM.** Correct for any real deployment. Requires downloading and
pre-processing an OpenStreetMap extract — several gigabytes and a multi-hour
`osrm-extract`/`osrm-contract` run for India alone — plus another container.

**A commercial routing API.** Would break the project's premise that every source
is free and public.

## Decision

The public demo server, with a long cache TTL (30 days) because roads do not move,
and the limitation documented rather than hidden.

## Consequences

- Routing works out of the box, which matters because it is on the critical path
  for the physical graph.
- Caching for 30 days means a repeated lane costs nothing, which is both polite to
  the demo server and the right TTL for the data.
- **The limitation is real:** the demo server is rate-limited and offers no uptime
  guarantee. A demo that hammers it will be throttled.
- **Switching to self-hosted changes one line** — the `osrm` base URL in
  `packages/connectors/src/sources/source-registry.ts`. No application code is
  aware of which server answered. That is the payoff of having a source registry
  at all.
