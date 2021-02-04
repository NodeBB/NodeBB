'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var nconf = require('nconf');

var utils = require('../src/utils');
var file = require('../src/file');

describe('file', () => {
	var filename = `${utils.generateUUID()}.png`;
	var folder = 'files';
	var uploadPath = path.join(nconf.get('upload_path'), folder, filename);
	var tempPath = path.join(__dirname, './files/test.png');

	afterEach((done) => {
		fs.unlink(uploadPath, () => {
			done();
		});
	});

	describe('copyFile', () => {
		it('should copy a file', (done) => {
			fs.copyFile(tempPath, uploadPath, (err) => {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var srcContent = fs.readFileSync(tempPath, 'utf8');
				var destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should override an existing file', (done) => {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');

			fs.copyFile(tempPath, uploadPath, (err) => {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var srcContent = fs.readFileSync(tempPath, 'utf8');
				var destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should error if source file does not exist', (done) => {
			fs.copyFile(`${tempPath}0000000000`, uploadPath, (err) => {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});

		it('should error if existing file is read only', (done) => {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');
			fs.chmodSync(uploadPath, '444');

			fs.copyFile(tempPath, uploadPath, (err) => {
				assert(err);
				assert(err.code === 'EPERM' || err.code === 'EACCES');

				done();
			});
		});
	});

	describe('saveFileToLocal', () => {
		it('should work', (done) => {
			file.saveFileToLocal(filename, folder, tempPath, (err) => {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				var oldFile = fs.readFileSync(tempPath, 'utf8');
				var newFile = fs.readFileSync(uploadPath, 'utf8');
				assert.strictEqual(oldFile, newFile);

				done();
			});
		});

		it('should error if source does not exist', (done) => {
			file.saveFileToLocal(filename, folder, `${tempPath}000000000`, (err) => {
				assert(err);
				assert.strictEqual(err.code, 'ENOENT');

				done();
			});
		});

		it('should error if folder is relative', (done) => {
			file.saveFileToLocal(filename, '../../text', `${tempPath}000000000`, (err) => {
				assert(err);
				assert.strictEqual(err.message, '[[error:invalid-path]]');
				done();
			});
		});
	});

	it('should walk directory', (done) => {
		file.walk(__dirname, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should convert mime type to extension', (done) => {
		assert.equal(file.typeToExtension('image/png'), '.png');
		assert.equal(file.typeToExtension(''), '');
		done();
	});
});
