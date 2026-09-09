/**
 * Creates an organisation and its first administrator.
 *
 *   npm run bootstrap:org --workspace @vitalink/api -- "Org Name" admin@example.com 'Password-Here-1'
 *
 * Note what this script does NOT do: it creates no drugs, no alerts and no
 * sample data of any kind. There is no seed dataset in this project (CI gate 2),
 * because a demo that shows numbers from a fixture is exactly what the data
 * covenant exists to prevent. The catalogue is populated by
 * `refresh-catalog.ts`, which fetches real openFDA data.
 */

/* eslint-disable no-console -- a CLI script's output is its interface */

import { createAuthService } from '@modules/auth';
import { connectMongo, connectRedis, disconnectMongo, disconnectRedis } from '@shared/db';

/** `node script.ts a b c` puts the first real argument at index 2. */
const ARGV_OFFSET = 2;

async function main(): Promise<void> {
  const [orgName, email, password] = process.argv.slice(ARGV_OFFSET);

  if (orgName === undefined || email === undefined || password === undefined) {
    console.error('usage: bootstrap:org "<org name>" <admin email> <password>');
    process.exit(1);
  }

  await connectMongo();
  await connectRedis();

  const service = createAuthService();

  // Upsert by domain, so re-running the script is safe.
  const org = await service.ensureOrg(orgName, email);
  console.log(`org ready: ${org.name} (${org.id})`);

  try {
    const user = await service.registerUser({
      email,
      password,
      displayName: email.split('@')[0] ?? 'Administrator',
      role: 'ADMINISTRATOR',
    });
    console.log(`administrator created: ${user.email} with ${String(user.scopes.length)} scopes`);
  } catch (error) {
    // A repeat run is not a failure worth a stack trace.
    console.log(
      `administrator not created: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  await disconnectMongo();
  await disconnectRedis();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
