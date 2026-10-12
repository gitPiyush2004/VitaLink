import { resolve } from 'node:path';

import { buildHistoryReport } from './report';

const directory = process.argv[2];
if (directory === undefined) throw new Error('Supply the immutable collection directory.');
buildHistoryReport(resolve(directory));
