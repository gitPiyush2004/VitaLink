/**
 * Which organisation a CLI script writes to.
 *
 * Every record in this system is org-scoped, and the scripts used to hardcode
 * `'cli'`. That worked and was wrong in a way that only showed up on the demo:
 * the pipeline wrote cascades, recommendations and scenario runs under an org
 * that no user belongs to, so the control tower — signed in as a real user —
 * queried its own org and correctly found nothing.
 *
 * The scripts now resolve the same org a user would see.
 */

import { createAuthService } from '@modules/auth';

/**
 * The org to write to: `VITALINK_ORG_ID`, or the only one in the database.
 *
 * @throws when there is no org, because the honest fix is to create one rather
 *   than to invent an id that nothing else will match.
 * @throws when there are several and none was named, because guessing would put
 *   a demo's data in one tenant and the demo's login in another — which is
 *   exactly the failure this function exists to prevent.
 */
export async function resolveCliOrg(): Promise<string> {
  const named = process.env.VITALINK_ORG_ID;
  if (named !== undefined && named.length > 0) return named;

  const orgs = await createAuthService().listOrgs();

  if (orgs.length === 0) {
    throw new Error(
      'No organisation exists yet, so a CLI script has nothing to write to. Create one with:\n' +
        '  npm run bootstrap:org --workspace @vitalink/api',
    );
  }

  if (orgs.length > 1) {
    throw new Error(
      'More than one organisation exists, and a CLI script must not guess which one a demo ' +
        'belongs to. Name it: VITALINK_ORG_ID=<id> npm run <script>',
    );
  }

  return String(orgs[0]?.id);
}
