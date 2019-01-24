'use strict';

var assert = require('assert');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var coverPhoto = require('../src/coverPhoto');
var meta = require('../src/meta');

describe('coverPhoto', function () {
	it('should get default group cover', function (done) {
		meta.config['groups:defaultCovers'] = '/assets/image1.png, /assets/image2.png';
		var result = coverPhoto.getDefaultGroupCover('registered-users');
		assert.equal(result, nconf.get('relative_path') + '/assets/image2.png');
		done();
	});

	it('should get default default profile cover', function (done) {
		meta.config['profile:defaultCovers'] = ' /assets/image1.png, /assets/image2.png ';
		var result = coverPhoto.getDefaultProfileCover(1);
		assert.equal(result, nconf.get('relative_path') + '/assets/image2.png');
		done();
	});
});
