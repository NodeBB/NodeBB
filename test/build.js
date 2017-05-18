'use strict';

var assert = require('assert');

var db = require('./mocks/databasemock');

describe('Build', function () {
	before(function (done) {
		db.setupMockDefaults(done);
	});

	it('should build all assets', function (done) {
		this.timeout(50000);
		var build = require('../src/meta/build');
		build.buildAll(function (err) {
			assert.ifError(err);
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
