'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var nconf = require('nconf');

var utils = require('../src/utils');
var file = require('../src/file');

describe('file', function () {
	var filename = utils.generateUUID() + '.png';
	var folder = 'files';
	var uploadPath = path.join(nconf.get('upload_path'), folder, filename);
	var tempPath = path.join(__dirname, './files/test.png');

	afterEach(function (done) {
		fs.unlink(uploadPath, function () {
			done();
		});
	});

	describe('copyFile', function () {
		it('should copy a file', function (done) {
			file.copyFile(tempPath, uploadPath, function (err) {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var srcContent = fs.readFileSync(tempPath, 'utf8');
				var destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should override an existing file', function (done) {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');

			file.copyFile(tempPath, uploadPath, function (err) {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var srcContent = fs.readFileSync(tempPath, 'utf8');
				var destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should error if source file does not exist', function (done) {
			file.copyFile(tempPath + '0000000000', uploadPath, function (err) {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});

		it('should error if existing file is read only', function (done) {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');
			fs.chmodSync(uploadPath, '444');

			file.copyFile(tempPath, uploadPath, function (err) {
				assert(err);
				assert(err.code === 'EPERM' || err.code === 'EACCES');

				done();
			});
		});
	});

	describe('saveFileToLocal', function () {
		it('should work', function (done) {
			file.saveFileToLocal(filename, folder, tempPath, function (err) {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var oldFile = fs.readFileSync(tempPath, 'utf8');
				var newFile = fs.readFileSync(uploadPath, 'utf8');
				assert.strictEqual(oldFile, newFile);

				done();
			});
		});

		it('should error if source does not exist', function (done) {
			file.saveFileToLocal(filename, folder, tempPath + '000000000', function (err) {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});
	});
});
