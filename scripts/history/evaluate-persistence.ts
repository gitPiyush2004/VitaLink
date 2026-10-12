import { resolve } from 'node:path';

import { evaluatePersistence } from './forecast/evaluate';

const collection = process.argv[2];
const output = process.argv[3];
if (collection === undefined || output === undefined) {
  throw new Error(
    'Supply the immutable historical collection directory and evaluation output directory.',
  );
}
evaluatePersistence(resolve(collection), resolve(output));
