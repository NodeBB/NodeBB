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

	it('should resize an image', function (done) {
		image.resizeImage({
			path: path.join(__dirname, 'files/normalise.jpg'),
			target: path.join(__dirname, 'files/normalise-resized.jpg'),
			width: 50,
			height: 40,
		}, function (err) {
			assert.ifError(err);
			image.size(path.join(__dirname, 'files/normalise-resized.jpg'), function (err, bitmap) {
				assert.ifError(err);
				assert.equal(bitmap.width, 50);
				assert.equal(bitmap.height, 40);
				done();
			});
		});
	});
});
