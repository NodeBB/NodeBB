'use strict';

import path from 'path';
import fs from 'fs';

const Logs = {} as any;

Logs.path = path.resolve(__dirname, '../../logs/output.log');

Logs.get = async function () {
	return await fs.promises.readFile(Logs.path, 'utf-8');
};

Logs.clear = async function () {
	await fs.promises.truncate(Logs.path, 0);
};

export default Logs;