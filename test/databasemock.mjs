'use strict';

import './cleanup.mjs';
import { doesNotThrow } from 'assert';
import winston from 'winston';
import('./registerTestFile.mjs').then(module => module.default(Promise.resolve()));
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

describe('Test database mock', function () {
	it('should not throw when loading the database mock', function () {
		winston.verbose('Loading database mock...');
		doesNotThrow(() => {
			require('./mocks/databasemock');
		});
	});
});
