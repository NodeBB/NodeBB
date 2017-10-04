'use strict';

var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var coverPhoto = require('../src/coverPhoto');
var meta = require('../src/meta');

describe('coverPhoto', function () {
	it('should get default group cover', function (done) {
		meta.config['groups:defaultCovers'] = 'image1.png,image2.png';
		var result = coverPhoto.getDefaultGroupCover('registered-users');
		assert.equal(result, 'image2.png');
		done();
	});

	it('should get default default profile cover', function (done) {
		meta.config['profile:defaultCovers'] = ' image1.png ,image2.png ';
		var result = coverPhoto.getDefaultProfileCover(1);
		assert.equal(result, 'image2.png');
		done();
	});
});
