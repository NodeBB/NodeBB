'use strict';

var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');

describe('Language detection', function () {
	it('should detect the language for a guest', function (done) {
		meta.config.autoDetectLang = 1;
		request(nconf.get('url') + '/api/config', {
			headers: {
				'Accept-Language': 'de-DE,de;q=0.5',
			},
		}, function (err, res, body) {
			assert.ifError(err);
			assert.ok(body);

			assert.strictEqual(JSON.parse(body).userLang, 'de');
			done();
		});
	});

	it('should do nothing when disabled', function (done) {
		meta.configs.set('autoDetectLang', 0, function (err) {
			assert.ifError(err);
			request(nconf.get('url') + '/api/config', {
				headers: {
					'Accept-Language': 'de-DE,de;q=0.5',
				},
			}, function (err, res, body) {
				assert.ifError(err);
				assert.ok(body);

				assert.strictEqual(JSON.parse(body).userLang, 'en-GB');
				done();
			});
		});
	});
});
