/**
 * The permission matrix, in one readable file (PART 8).
 *
 * Six roles exist because six genuinely distinct workflows exist. The point of
 * keeping the whole matrix here rather than scattering `if (role === ...)` checks
 * through controllers is that "what can a Procurement Manager do?" is answerable
 * by reading one table.
 *
 * Routes declare the scope they need; the `rbac` middleware compares it against
 * the scopes baked into the access token at login.
 */

import type { Role, Scope } from '@vitalink/contracts';

const READ_EVERYTHING: Scope[] = [
  'catalog:read',
  'graph:read',
  'signals:read',
  'alerts:read',
  'quarantine:read',
  'cascade:read',
  'reliability:read',
  'scenarios:read',
  'recommendations:read',
  'logistics:read',
  'cases:read',
  'eval:read',
];

/**
 * Role -> scopes.
 *
 * Deliberate boundaries worth explaining:
 *  - Only Procurement sets a budget ceiling, because a budget is a procurement
 *    decision; the Logistics Manager chooses the carrier within it.
 *  - Only Logistics runs quotes and logistics recommendations.
 *  - Regulatory-QA can read everything and write cases, but cannot run
 *    interventions — its job is to review, not to act.
 *  - Analyst-Viewer is read-only, including for evaluation runs.
 */
export const ROLE_SCOPES: Record<Role, Scope[]> = {
  ADMINISTRATOR: ['admin:all'],

  SUPPLY_CHAIN_MANAGER: [
    ...READ_EVERYTHING,
    'cascade:run',
    'scenarios:run',
    'recommendations:issue',
    'cases:write',
    'webhooks:read',
  ],

  PROCUREMENT_MANAGER: [
    ...READ_EVERYTHING,
    'scenarios:run',
    'recommendations:issue',
    'cases:write',
  ],

  LOGISTICS_MANAGER: [
    ...READ_EVERYTHING,
    'logistics:quote',
    'logistics:recommend',
    'scenarios:run',
    'cases:write',
  ],

  REGULATORY_QA: [...READ_EVERYTHING, 'cases:write', 'webhooks:read'],

  ANALYST_VIEWER: [...READ_EVERYTHING],
};

/** `admin:all` is a wildcard, so administrators do not need every scope listed. */
export function hasScope(granted: readonly Scope[], required: Scope): boolean {
  return granted.includes('admin:all') || granted.includes(required);
}

export function scopesForRole(role: Role): Scope[] {
  return ROLE_SCOPES[role];
}
