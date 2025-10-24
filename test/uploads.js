'use strict';

const async = require('async');
const assert = require('assert');
const nconf = require('nconf');
const path = require('path');
const fs = require('fs').promises;

const db = require('./mocks/databasemock');
const categories = require('../src/categories');
const topics = require('../src/topics');
const posts = require('../src/posts');
const user = require('../src/user');
const groups = require('../src/groups');
const privileges = require('../src/privileges');
const meta = require('../src/meta');
const socketUser = require('../src/socket.io/user');
const helpers = require('./helpers');
const file = require('../src/file');
const image = require('../src/image');
const request = require('../src/request');

const emptyUploadsFolder = async () => {
	const files = await fs.readdir(`${nconf.get('upload_path')}/files`);
	await Promise.all(files.map(async (filename) => {
		await file.delete(`${nconf.get('upload_path')}/files/${filename}`);
	}));
};

describe('Upload Controllers', () => {
	let tid;
	let cid;
	let pid;
	let adminUid;
	let regularUid;
	let maliciousUid;

	before((done) => {
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			adminUid: function (next) {
				user.create({ username: 'admin', password: 'barbar' }, next);
			},
			regularUid: function (next) {
				user.create({ username: 'regular', password: 'zugzug' }, next);
			},
			maliciousUid: function (next) {
				user.create({ username: 'malicioususer', password: 'herpderp' }, next);
			},
		}, (err, results) => {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
			maliciousUid = results.maliciousUid;
			cid = results.category.cid;

			topics.post({ uid: adminUid, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, (err, result) => {
				if (err) {
					return done(err);
				}
				tid = result.topicData.tid;
				pid = result.postData.pid;
				groups.join('administrators', adminUid, done);
			});
		});
	});

	describe('regular user uploads rate limits', () => {
		let jar;
		let csrf_token;

		before(async () => {
			({ jar, csrf_token } = await helpers.loginUser('malicioususer', 'herpderp'));
			await privileges.global.give(['groups:upload:post:file'], 'registered-users');
		});

		it('should fail if the user exceeds the upload rate limit threshold', async () => {
			const oldValue = meta.config.allowedFileExtensions;
			meta.config.allowedFileExtensions = 'png,jpg,bmp,html';
			require('../src/middleware/uploads').clearCache();
			const times = meta.config.uploadRateLimitThreshold + 1;
			for (let i = 0; i < times; i++) {
				// eslint-disable-next-line no-await-in-loop
				const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/503.html'), {}, jar, csrf_token);
				if (i + 1 >= times) {
					assert.strictEqual(response.statusCode, 500);
					assert.strictEqual(body.error, '[[error:upload-ratelimit-reached]]');
				} else {
					assert.strictEqual(response.statusCode, 200);
					assert(body && body.status && body.response && body.response.images);
					assert(Array.isArray(body.response.images));
					assert(body.response.images[0].url);
				}
			}
			meta.config.allowedFileExtensions = oldValue;
		});
	});

	describe('regular user uploads', () => {
		let jar;
		let csrf_token;

		before(async () => {
			meta.config.uploadRateLimitThreshold = 1000;
			({ jar, csrf_token } = await helpers.loginUser('regular', 'zugzug'));
			await privileges.global.give(['groups:upload:post:file'], 'registered-users');
		});

		it('should upload an image to a post', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
		});

		it('should upload an image to a post and then delete the upload', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);

			assert.strictEqual(response.statusCode, 200);
			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
			const name = body.response.images[0].url.replace(`${nconf.get('relative_path') + nconf.get('upload_url')}`, '');
			await socketUser.deleteUpload({ uid: regularUid }, { uid: regularUid, name: name });

			const uploads = await db.getSortedSetRange(`uid:${regularUid}:uploads`, 0, -1);
			assert.equal(uploads.includes(name), false);
		});

		it('should not allow deleting if path is not correct', (done) => {
			socketUser.deleteUpload({ uid: adminUid }, { uid: regularUid, name: '../../bkconfig.json' }, (err) => {
				assert.equal(err.message, '[[error:invalid-path]]');
				done();
			});
		});

		it('should not allow deleting if path is not correct', (done) => {
			socketUser.deleteUpload({ uid: adminUid }, { uid: regularUid, name: '/files/../../bkconfig.json' }, (err) => {
				assert.equal(err.message, '[[error:invalid-path]]');
				done();
			});
		});

		it('should resize and upload an image to a post', async () => {
			const oldValue = meta.config.resizeImageWidth;
			meta.config.resizeImageWidth = 10;
			meta.config.resizeImageWidthThreshold = 10;
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);

			assert.equal(response.statusCode, 200);
			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
			assert(body.response.images[0].url.match(/\/assets\/uploads\/files\/\d+-test-resized\.png/));
			meta.config.resizeImageWidth = oldValue;
			meta.config.resizeImageWidthThreshold = 2000;
		});

		it('should resize and upload an image to a post and replace original', async () => {
			const oldValue = meta.config.resizeImageWidth;
			const keepOldValue = meta.config.resizeImageKeepOriginal;
			meta.config.resizeImageWidth = 10;
			meta.config.resizeImageWidthThreshold = 10;
			meta.config.resizeImageKeepOriginal = 0;
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);

			assert.equal(response.statusCode, 200);
			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
			assert(body.response.images[0].url.match(/\/assets\/uploads\/files\/\d+-test.png/));
			meta.config.resizeImageWidth = oldValue;
			meta.config.resizeImageWidthThreshold = 2000;
			meta.config.resizeImageKeepOriginal = keepOldValue;
		});

		it('should upload a file to a post', async () => {
			const oldValue = meta.config.allowedFileExtensions;
			meta.config.allowedFileExtensions = 'png,jpg,bmp,html';
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/503.html'), {}, jar, csrf_token);
			meta.config.allowedFileExtensions = oldValue;

			assert.strictEqual(response.statusCode, 200);
			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
		});

		it('should upload a file with utf8 characters in the name to a post', async () => {
			const { body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/测试.jpg'), {}, jar, csrf_token);

			assert(body.response.images[0].url.endsWith('测试.jpg'));
		});

		it('should fail to upload image to post if image dimensions are too big', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/toobig.png'), {}, jar, csrf_token);
			assert.strictEqual(response.statusCode, 500);
			assert(body && body.status && body.status.message);
			assert.strictEqual(body.status.message, 'Image dimensions are too big');
		});

		it('should fail to upload image to post if image is broken', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/brokenimage.png'), {}, jar, csrf_token);
			assert.strictEqual(response.statusCode, 500);
			assert(body && body.status && body.status.message);
			assert.strictEqual(body.status.message, 'pngload_buffer: end of stream');
		});

		it('should fail if file is not an image', (done) => {
			image.isFileTypeAllowed(path.join(__dirname, '../test/files/notanimage.png'), (err) => {
				assert.strictEqual(err.message, 'Input file contains unsupported image format');
				done();
			});
		});

		it('should fail if file is not an image', (done) => {
			image.isFileTypeAllowed(path.join(__dirname, '../test/files/notanimage.png'), (err) => {
				assert.strictEqual(err.message, 'Input file contains unsupported image format');
				done();
			});
		});

		it('should fail if file is not an image', (done) => {
			image.size(path.join(__dirname, '../test/files/notanimage.png'), (err) => {
				assert.strictEqual(err.message, 'Input file contains unsupported image format');
				done();
			});
		});

		it('should fail if file is missing', (done) => {
			image.size(path.join(__dirname, '../test/files/doesnotexist.png'), (err) => {
				assert(err.message.startsWith('Input file is missing'));
				done();
			});
		});

		it('should not allow non image uploads', (done) => {
			socketUser.updateCover({ uid: 1 }, { uid: 1, file: { path: '../../text.txt' } }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not allow non image uploads', (done) => {
			socketUser.updateCover({ uid: 1 }, { uid: 1, imageData: 'data:text/html;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMik+' }, (err) => {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		it('should not allow svg uploads', (done) => {
			socketUser.updateCover({ uid: 1 }, { uid: 1, imageData: 'data:image/svg;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMik+' }, (err) => {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		it('should not allow non image uploads', (done) => {
			socketUser.uploadCroppedPicture({ uid: 1 }, { uid: 1, file: { path: '../../text.txt' } }, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not allow non image uploads', (done) => {
			socketUser.uploadCroppedPicture({ uid: 1 }, { uid: 1, imageData: 'data:text/html;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMik+' }, (err) => {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		it('should not allow svg uploads', (done) => {
			socketUser.uploadCroppedPicture({ uid: 1 }, { uid: 1, imageData: 'data:image/svg;base64,PHN2Zy9vbmxvYWQ9YWxlcnQoMik+' }, (err) => {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		it('should delete users uploads if account is deleted', async () => {
			const uid = await user.create({ username: 'uploader', password: 'barbar' });
			const file = require('../src/file');
			const data = await helpers.loginUser('uploader', 'barbar');
			const { body } = await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, data.jar, data.csrf_token);

			assert(body && body.status && body.response && body.response.images);
			assert(Array.isArray(body.response.images));
			assert(body.response.images[0].url);
			const { url } = body.response.images[0];

			await user.delete(1, uid);

			const filePath = path.join(nconf.get('upload_path'), url.replace('/assets/uploads', ''));
			const exists = await file.exists(filePath);
			assert(!exists);
		});

		after(emptyUploadsFolder);
	});

	describe('admin uploads', () => {
		let jar;
		let csrf_token;
		let regularJar;
		let regular_csrf_token;

		before(async () => {
			({ jar, csrf_token } = await helpers.loginUser('admin', 'barbar'));
			const regularLogin = await helpers.loginUser('regular', 'zugzug');
			regularJar = regularLogin.jar;
			regular_csrf_token = regularLogin.csrf_token;
		});

		it('should upload site logo', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadlogo`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);
			assert.strictEqual(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/site-logo.png`);
		});

		it('should fail to upload invalid file type', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/503.html'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token);
			assert.strictEqual(response.statusCode, 500);
			assert.equal(body.error, '[[error:invalid-image-type, image&#x2F;png&amp;#44; image&#x2F;jpeg&amp;#44; image&#x2F;pjpeg&amp;#44; image&#x2F;jpg&amp;#44; image&#x2F;gif&amp;#44; image&#x2F;svg+xml]]');
		});

		it('should fail to upload category image with invalid json params', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/test.png'), { params: 'invalid json' }, jar, csrf_token);
			assert.strictEqual(response.statusCode, 500);
			assert.equal(body.error, '[[error:invalid-json]]');
		});

		it('should upload category image', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/test.png'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/category/category-1.png`);
		});

		it('should upload svg as category image after cleaning it up', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/dirty.svg'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/category/category-1.svg`);
			const svgContents = await fs.readFile(path.join(__dirname, '../test/uploads/category/category-1.svg'), 'utf-8');
			assert.strictEqual(svgContents.includes('<script>'), false);
		});

		it('should upload default avatar', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadDefaultAvatar`, path.join(__dirname, '../test/files/test.png'), { }, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/avatar-default.png`);
		});

		it('should upload og image', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadOgImage`, path.join(__dirname, '../test/files/test.png'), { }, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/og-image.png`);
		});

		it('should upload favicon', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadfavicon`, path.join(__dirname, '../test/files/favicon.ico'), {}, jar, csrf_token);
			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, '/assets/uploads/system/favicon.ico');
		});

		it('should upload touch icon', async () => {
			const touchiconAssetPath = '/assets/uploads/system/touchicon-orig.png';
			const { response, body } = await helpers.uploadFile(
				`${nconf.get('url')}/api/admin/uploadTouchIcon`,
				path.join(__dirname, '../test/files/test.png'),
				{},
				jar,
				csrf_token
			);

			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, touchiconAssetPath);
			meta.config['brand:touchIcon'] = touchiconAssetPath;
			const { response: res1, body: body1 } = await request.get(`${nconf.get('url')}/apple-touch-icon`);
			assert.equal(res1.statusCode, 200);
			assert(body1);
		});

		it('should upload regular file', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/upload/file`, path.join(__dirname, '../test/files/test.png'), {
				params: JSON.stringify({
					folder: 'system',
				}),
			}, jar, csrf_token);

			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body));
			assert.equal(body[0].url, '/assets/uploads/system/test.png');
			assert(file.existsSync(path.join(nconf.get('upload_path'), 'system', 'test.png')));
		});

		it('should fail to upload regular file in wrong directory', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/upload/file`, path.join(__dirname, '../test/files/test.png'), {
				params: JSON.stringify({
					folder: '../../system',
				}),
			}, jar, csrf_token);

			assert.equal(response.statusCode, 500);
			assert.strictEqual(body.error, '[[error:invalid-path]]');
		});

		it('should fail to upload regular file if directory does not exist', async () => {
			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/admin/upload/file`, path.join(__dirname, '../test/files/test.png'), {
				params: JSON.stringify({
					folder: 'does-not-exist',
				}),
			}, jar, csrf_token);

			assert.equal(response.statusCode, 500);
			assert.strictEqual(body.error, '[[error:invalid-path]]');
		});

		describe('ACP uploads screen', () => {
			it('should create a folder', async () => {
				const { response } = await helpers.createFolder('', 'myfolder', jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
				assert(file.existsSync(path.join(nconf.get('upload_path'), 'myfolder')));
			});

			it('should fail to create a folder if it already exists', async () => {
				const { response, body } = await helpers.createFolder('', 'myfolder', jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.deepStrictEqual(body.status, {
					code: 'forbidden',
					message: 'Folder exists',
				});
			});

			it('should fail to create a folder as a non-admin', async () => {
				const { response, body } = await helpers.createFolder('', 'hisfolder', regularJar, regular_csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.deepStrictEqual(body.status, {
					code: 'forbidden',
					message: 'You are not authorised to make this call',
				});
			});

			it('should fail to create a folder in wrong directory', async () => {
				const { response, body } = await helpers.createFolder('../traversing', 'unexpectedfolder', jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.deepStrictEqual(body.status, {
					code: 'forbidden',
					message: 'Invalid path',
				});
			});

			it('should use basename of given folderName to create new folder', async () => {
				const { response } = await helpers.createFolder('/myfolder', '../another folder', jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
				const slugifiedName = 'another-folder';
				assert(file.existsSync(path.join(nconf.get('upload_path'), 'myfolder', slugifiedName)));
			});

			it('should fail to delete a file as a non-admin', async () => {
				const { response, body } = await request.delete(`${nconf.get('url')}/api/v3/files`, {
					body: {
						path: '/system/test.png',
					},
					jar: regularJar,
					headers: {
						'x-csrf-token': regular_csrf_token,
					},
				});
				assert.strictEqual(response.statusCode, 403);
				assert.deepStrictEqual(body.status, {
					code: 'forbidden',
					message: 'You are not authorised to make this call',
				});
			});
		});

		after(emptyUploadsFolder);
	});

	describe('library methods', () => {
		describe('.getOrphans()', () => {
			before(async () => {
				const { jar, csrf_token } = await helpers.loginUser('regular', 'zugzug');
				await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);
			});

			it('should return files with no post associated with them', async () => {
				const orphans = await posts.uploads.getOrphans();

				assert.strictEqual(orphans.length, 1);
				orphans.forEach((relPath) => {
					assert(relPath.startsWith('/files/'));
					assert(relPath.endsWith('test.png'));
				});
			});

			after(emptyUploadsFolder);
		});

		describe('.cleanOrphans()', () => {
			let _orphanExpiryDays;

			before(async () => {
				const { jar, csrf_token } = await helpers.loginUser('regular', 'zugzug');
				await helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token);

				// modify all files in uploads folder to be 30 days old
				const files = await fs.readdir(`${nconf.get('upload_path')}/files`);
				const p30d = (Date.now() - (1000 * 60 * 60 * 24 * 30)) / 1000;
				await Promise.all(files.map(async (filename) => {
					await fs.utimes(`${nconf.get('upload_path')}/files/${filename}`, p30d, p30d);
				}));

				_orphanExpiryDays = meta.config.orphanExpiryDays;
			});

			it('should not touch orphans if not configured to do so', async () => {
				await posts.uploads.cleanOrphans();
				const orphans = await posts.uploads.getOrphans();

				assert.strictEqual(orphans.length, 1);
			});

			it('should not touch orphans if they are newer than the configured expiry', async () => {
				meta.config.orphanExpiryDays = 60;
				await posts.uploads.cleanOrphans();
				const orphans = await posts.uploads.getOrphans();

				assert.strictEqual(orphans.length, 1);
			});

			it('should delete orphans older than the configured number of days', async () => {
				meta.config.orphanExpiryDays = 7;
				await posts.uploads.cleanOrphans();
				const orphans = await posts.uploads.getOrphans();

				assert.strictEqual(orphans.length, 0);
			});

			after(async () => {
				await emptyUploadsFolder();
				meta.config.orphanExpiryDays = _orphanExpiryDays;
			});
		});
	});
});
