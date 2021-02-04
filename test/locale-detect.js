'use strict';

var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');

describe('Language detection', () => {
	it('should detect the language for a guest', (done) => {
		meta.configs.set('autoDetectLang', 1, (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/config`, {
				headers: {
					'Accept-Language': 'de-DE,de;q=0.5',
				},
				json: true,
			}, (err, res, body) => {
				assert.ifError(err);
				assert.ok(body);

				assert.strictEqual(body.userLang, 'de');
				done();
			});
		});
	});

	it('should do nothing when disabled', (done) => {
		meta.configs.set('autoDetectLang', 0, (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/api/config`, {
				headers: {
					'Accept-Language': 'de-DE,de;q=0.5',
				},
				json: true,
			}, (err, res, body) => {
				assert.ifError(err);
				assert.ok(body);

				assert.strictEqual(body.userLang, 'en-GB');
				done();
			});
		});
	});
});
