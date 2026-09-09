'use strict';

const db = require('./mocks/databasemock');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

const utils = require('../src/utils');
const file = require('../src/file');

describe('file', () => {
	const filename = `${utils.generateUUID()}.png`;
	const folder = 'files';
	const uploadPath = path.join(nconf.get('upload_path'), folder, filename);
	const tempPath = path.join(__dirname, './files/test.png');

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

				const srcContent = fs.readFileSync(tempPath, 'utf8');
				const destContent = fs.readFileSync(uploadPath, 'utf8');

				assert.strictEqual(srcContent, destContent);
				done();
			});
		});

		it('should override an existing file', (done) => {
			fs.writeFileSync(uploadPath, 'hsdkjhgkjsfhkgj');

			fs.copyFile(tempPath, uploadPath, (err) => {
				assert.ifError(err);

				assert(file.existsSync(uploadPath));

				const srcContent = fs.readFileSync(tempPath, 'utf8');
				const destContent = fs.readFileSync(uploadPath, 'utf8');

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

				const oldFile = fs.readFileSync(tempPath, 'utf8');
				const newFile = fs.readFileSync(uploadPath, 'utf8');
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

	describe('file.isPathInside', () => {
		const uploadPath = nconf.get('upload_path');

		it('should return true for valid paths inside the base directory', () => {
			const validPaths = [
				// Standard absolute paths
				path.join(uploadPath, 'test.png'),
				path.join(uploadPath, 'files/test.png'),

				// Standard relative paths
				'test.png',
				'files/test.png',

				// Current directory edge cases
				'',
				'.',

				// Paths with redundant dot-segments that still resolve inside
				'files/../test.png',
				path.join(uploadPath, 'files/../test.png'),
			];

			for (const p of validPaths) {
				assert.strictEqual(file.isPathInside(uploadPath, p), true, `Failed on valid path: ${p}`);
			}
		});

		it('should return false for traversal attempts and paths outside the base directory', () => {
			const invalidPaths = [
				// The Sibling Directory Bypass
				'../uploads-secret',
				'../uploads-secret/test.png',
				`${uploadPath}-secret`,

				// Standard Path Traversal
				'../',
				'..',
				'../../etc/passwd',

				// Sneaky Traversal (redundant slashes)
				'..//..//etc/passwd',
				'files/../../etc/passwd',

				// Absolute Path Injection (escaping the base entirely)
				'/etc/passwd',
				'/root/secret.txt',

				// Absolute path guaranteed to work on current OS (Windows/Linux)
				path.resolve('/etc/passwd'),
			];

			for (const p of invalidPaths) {
				assert.strictEqual(file.isPathInside(uploadPath, p), false, `Failed on invalid path: ${p}`);
			}
		});
	});
});
