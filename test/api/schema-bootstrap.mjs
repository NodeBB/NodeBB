'use strict';

import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { writeFile } from 'fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readApiPath = resolve(__dirname, '../../public/openapi/read.yaml');
const writeApiPath = resolve(__dirname, '../../public/openapi/write.yaml');
const readApi = await SwaggerParser.dereference(readApiPath);
const writeApi = await SwaggerParser.dereference(writeApiPath);

await writeFile(resolve(__dirname, '../files/readApi.json'), JSON.stringify(readApi, null));
await writeFile(resolve(__dirname, '../files/writeApi.json'), JSON.stringify(writeApi, null));

process.stdout.write('[test/api/schema] Schema bootstrap complete.\n');