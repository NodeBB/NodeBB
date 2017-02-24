'use strict';

var async = require('async');
var assert = require('assert');

var db = require('./mocks/databasemock');
var helpers = require('../public/src/modules/helpers');

describe('helpers', function () {
	it('should return false if item doesn\'t exist', function (done) {
		var flag = helpers.displayMenuItem({ navigation: [] }, 0);
		assert(!flag);
		done();
	});


	it('should return false if route is /users and privateUserInfo is on and user is not logged in', function (done) {
		var flag = helpers.displayMenuItem({
			navigation: [{ route: '/users' }],
			privateUserInfo: true,
			config: {
				loggedIn: false,
			},
		}, 0);
		assert(!flag);
		done();
	});

	it('should return false if route is /tags and privateTagListing is on and user is not logged in', function (done) {
		var flag = helpers.displayMenuItem({
			navigation: [{ route: '/tags' }],
			privateTagListing: true,
			config: {
				loggedIn: false,
			},
		}, 0);
		assert(!flag);
		done();
	});

	it('should stringify object', function (done) {
		var str = helpers.stringify({ a: 'herp < derp > and & quote "' });
		assert.equal(str, '{&quot;a&quot;:&quot;herp &lt; derp &gt; and &amp; quote \\&quot;&quot;}');
		done();
	});

	it('should escape html', function (done) {
		var str = helpers.escape('gdkfhgk < some > and &');
		assert.equal(str, 'gdkfhgk &lt; some &gt; and &amp;');
		done();
	});
});
