/**
 * Creates an organisation and its first administrator.
 *
 *   npm run bootstrap:org --workspace @vitalink/api -- Org-Name admin@example.com 'Password-Here-1'
 *
 * ## Why the org name has no spaces in that example
 *
 * `npm run` re-joins the arguments after `--` into one string and lets the shell
 * re-split it, so a quoted `"BioCipher Health"` arrives as two arguments and
 * every argument after it shifts left by one. The failure that produces is
 * baffling: the *email* is then `Health`, the *password* is the email address,
 * and the script reports that the password does not meet the policy — which is
 * true, and says nothing about what actually went wrong.
 *
 * Rather than only documenting it, `checkArguments` below detects the shape and
 * names it. A spaced org name still works if it reaches the script as one
 * argument; run the file through `tsx` directly if you need one.
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
import { AppError } from '@shared/errors';

/** `node script.ts a b c` puts the first real argument at index 2. */
const ARGV_OFFSET = 2;
const EXPECTED_ARGUMENTS = 3;

const USAGE = 'usage: bootstrap:org <org-name-without-spaces> <admin email> <password>';

/**
 * Rejects the argument shapes that produce a misleading error further down.
 *
 * The second check is the valuable one. An email in the third slot means the
 * arguments shifted, which npm does silently whenever the org name contains a
 * space — and the resulting complaint is about the password policy, three layers
 * away from the cause.
 */
function checkArguments(args: string[]): void {
  const [orgName, email] = args;

  if (orgName === undefined || email === undefined || args[2] === undefined) {
    console.error(USAGE);
    process.exit(1);
  }

  if (!email.includes('@')) {
    console.error(
      `The second argument should be an email address, and "${email}" is not one.\n` +
        'This usually means an argument contained a space: `npm run` re-splits everything\n' +
        'after `--`, so a quoted org name arrives as two arguments and shifts the rest.\n' +
        USAGE,
    );
    process.exit(1);
  }

  if (args.length > EXPECTED_ARGUMENTS) {
    console.error(
      `Expected 3 arguments and got ${String(args.length)}: ${args.slice(ARGV_OFFSET + 1).join(', ')}\n` +
        'Spaces in an argument are the usual cause. See the note at the top of this file.\n' +
        USAGE,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(ARGV_OFFSET);
  checkArguments(args);

  const [orgName, email, password] = args;
  if (orgName === undefined || email === undefined || password === undefined) return;

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
    // A repeat run is not a failure worth a stack trace — but "does not meet
    // the policy" without saying *which* rule is a message that cannot be acted
    // on, and `AppError` has been carrying the answer in `details` all along.
    console.log(
      `administrator not created: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (error instanceof AppError && error.details !== undefined) {
      console.log(`  ${JSON.stringify(error.details)}`);
    }
  }

  await disconnectMongo();
  await disconnectRedis();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
