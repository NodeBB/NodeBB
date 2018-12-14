'use strict';


var	assert = require('assert');
var nconf = require('nconf');
var db = require('./mocks/databasemock');


describe('Test database', function () {
	it('should work', function () {
		assert.doesNotThrow(function () {
			require('./mocks/databasemock');
		});
	});

	describe('info', function () {
		it('should return info about database', function (done) {
			db.info(db.client, function (err, info) {
				assert.ifError(err);
				assert(info);
				done();
			});
		});

		it('should not error and return info if client is falsy', function (done) {
			db.info(null, function (err, info) {
				assert.ifError(err);
				assert(info);
				done();
			});
		});
	});

	describe('checkCompatibility', function () {
		it('should not throw', function (done) {
			db.checkCompatibility(done);
		});

		it('should return error with a too low version', function (done) {
			var dbName = nconf.get('database');
			if (dbName === 'redis') {
				db.checkCompatibilityVersion('2.4.0', function (err) {
					assert.equal(err.message, 'Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.');
					done();
				});
			} else if (dbName === 'mongo') {
				db.checkCompatibilityVersion('1.8.0', function (err) {
					assert.equal(err.message, 'The `mongodb` package is out-of-date, please run `./nodebb setup` again.');
					done();
				});
			} else if (dbName === 'postgres') {
				db.checkCompatibilityVersion('6.3.0', function (err) {
					assert.equal(err.message, 'The `pg` package is out-of-date, please run `./nodebb setup` again.');
					done();
				});
			}
		});
	});


	require('./database/keys');
	require('./database/list');
	require('./database/sets');
	require('./database/hash');
	require('./database/sorted');
});
