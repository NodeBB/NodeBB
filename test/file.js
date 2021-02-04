'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var nconf = require('nconf');

var utils = require('../src/utils');
var file = require('../src/file');

describe('file', function () {
	var filename = `${utils.generateUUID()}.png`;
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
			fs.copyFile(tempPath, uploadPath, function (err) {
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

			fs.copyFile(tempPath, uploadPath, function (err) {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var srcContent = fs.readFileSync(tempPath, 'utf8');
				var destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should error if source file does not exist', function (done) {
			fs.copyFile(`${tempPath}0000000000`, uploadPath, function (err) {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});

		it('should error if existing file is read only', function (done) {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');
			fs.chmodSync(uploadPath, '444');

			fs.copyFile(tempPath, uploadPath, function (err) {
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
			file.saveFileToLocal(filename, folder, `${tempPath}000000000`, function (err) {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});

		it('should error if folder is relative', function (done) {
			file.saveFileToLocal(filename, '../../text', `${tempPath}000000000`, function (err) {
				assert(err);
				assert.strictEqual(err.message, '[[error:invalid-path]]');
				done();
			});
		});
	});

	it('should walk directory', function (done) {
		file.walk(__dirname, function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should convert mime type to extension', function (done) {
		assert.equal(file.typeToExtension('image/png'), '.png');
		assert.equal(file.typeToExtension(''), '');
		done();
	});
});
