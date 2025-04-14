'use strict';


import assert, { fail, ifError, equal } from 'assert';
import nconf from 'nconf';
import('./registerTestFile.mjs').then(module => module.default(new Promise(resolve => resolve())));
import './cleanup.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const databasemock = require('./mocks/databasemock');

describe('Test database', function () {
	describe('info', () => {
		it('should return info about database', async () => {
			const info = await databasemock.info(databasemock.client);
			assert(info);
		});

		it('should not error and return info if client is falsy', async function () {
			await databasemock.info(null).then((info) => {
				assert(info);
			}, (reason) => {
				fail(reason);
			}).catch((err) => {
				ifError(err);
			});
		});
	});

	describe('checkCompatibility', () => {
		it('should not throw', (done) => {
			databasemock.checkCompatibility(done);
		});

		it('should return error with a too low version', (done) => {
			const dbName = nconf.get('database');
			if (dbName === 'redis') {
				databasemock.checkCompatibilityVersion('2.4.0', (err) => {
					equal(err.message, 'Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.');
					done();
				});
			} else if (dbName === 'mongo') {
				databasemock.checkCompatibilityVersion('1.8.0', (err) => {
					equal(err.message, 'The `mongodb` package is out-of-date, please run `./nodebb setup` again.');
					done();
				});
			} else if (dbName === 'postgres') {
				databasemock.checkCompatibilityVersion('6.3.0', (err) => {
					equal(err.message, 'The `pg` package is out-of-date, please run `./nodebb setup` again.');
					done();
				});
			} else if (dbName === 'mysql') {
				databasemock.checkCompatibilityVersion('3.10.1', (err) => {
					equal(err.message, 'The `mysql2` package is out-of-date, please run `./nodebb setup` again.');
					done();
				});
			}
		});
	});
});
