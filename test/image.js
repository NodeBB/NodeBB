'use strict';

var assert = require('assert');
var path = require('path');

var db = require('./mocks/databasemock');
var image = require('../src/image');
var file = require('../src/file');

describe('image', function () {

	it('should normalise image', function (done) {
		image.normalise(path.join(__dirname, 'files/normalise.jpg'), '.jpg', function (err) {
			assert.ifError(err);
			file.exists(path.join(__dirname, 'files/normalise.jpg.png'), function (err, exists) {
				assert.ifError(err);
				assert(exists);
				done();
			});
		});
	});

});
