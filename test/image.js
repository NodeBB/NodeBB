'use strict';

const assert = require('assert');
const path = require('path');

const db = require('./mocks/databasemock');
const image = require('../src/image');
const file = require('../src/file');

describe('image', () => {
	it('should normalise image', (done) => {
		image.normalise(path.join(__dirname, 'files/normalise.jpg'), '.jpg', (err) => {
			assert.ifError(err);
			file.exists(path.join(__dirname, 'files/normalise.jpg.png'), (err, exists) => {
				assert.ifError(err);
				assert(exists);
				done();
			});
		});
	});

	it('should resize an image', (done) => {
		image.resizeImage({
			path: path.join(__dirname, 'files/normalise.jpg'),
			target: path.join(__dirname, 'files/normalise-resized.jpg'),
			width: 50,
			height: 40,
		}, (err) => {
			assert.ifError(err);
			image.size(path.join(__dirname, 'files/normalise-resized.jpg'), (err, bitmap) => {
				assert.ifError(err);
				assert.equal(bitmap.width, 50);
				assert.equal(bitmap.height, 40);
				done();
			});
		});
	});
});
