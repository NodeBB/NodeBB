'use strict';

const async = require('async');
const	assert = require('assert');
const nconf = require('nconf');
const path = require('path');
const request = require('request');

const db = require('./mocks/databasemock');
const categories = require('../src/categories');
const topics = require('../src/topics');
const user = require('../src/user');
const groups = require('../src/groups');
const privileges = require('../src/privileges');
const meta = require('../src/meta');
const socketUser = require('../src/socket.io/user');
const helpers = require('./helpers');
const file = require('../src/file');
const image = require('../src/image');

describe('Upload Controllers', () => {
	let tid;
	let cid;
	let pid;
	let adminUid;
	let regularUid;

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
		}, (err, results) => {
			if (err) {
				return done(err);
			}
			adminUid = results.adminUid;
			regularUid = results.regularUid;
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

	describe('regular user uploads', () => {
		let jar;
		let csrf_token;

		before((done) => {
			helpers.loginUser('regular', 'zugzug', (err, _jar, _csrf_token) => {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				privileges.global.give(['groups:upload:post:file'], 'registered-users', done);
			});
		});

		it('should upload an image to a post', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body && body.status && body.response && body.response.images);
				assert(Array.isArray(body.response.images));
				assert(body.response.images[0].url);
				done();
			});
		});

		it('should upload an image to a post and then delete the upload', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 200);
				assert(body && body.status && body.response && body.response.images);
				assert(Array.isArray(body.response.images));
				assert(body.response.images[0].url);
				const name = body.response.images[0].url.replace(nconf.get('relative_path') + nconf.get('upload_url'), '');
				socketUser.deleteUpload({ uid: regularUid }, { uid: regularUid, name: name }, (err) => {
					assert.ifError(err);
					db.getSortedSetRange(`uid:${regularUid}:uploads`, 0, -1, (err, uploads) => {
						assert.ifError(err);
						assert.equal(uploads.includes(name), false);
						done();
					});
				});
			});
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

		it('should resize and upload an image to a post', (done) => {
			const oldValue = meta.config.resizeImageWidth;
			meta.config.resizeImageWidth = 10;
			meta.config.resizeImageWidthThreshold = 10;
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body && body.status && body.response && body.response.images);
				assert(Array.isArray(body.response.images));
				assert(body.response.images[0].url);
				assert(body.response.images[0].url.match(/\/assets\/uploads\/files\/\d+-test-resized\.png/));
				meta.config.resizeImageWidth = oldValue;
				meta.config.resizeImageWidthThreshold = 1520;
				done();
			});
		});


		it('should upload a file to a post', (done) => {
			const oldValue = meta.config.allowedFileExtensions;
			meta.config.allowedFileExtensions = 'png,jpg,bmp,html';
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/503.html'), {}, jar, csrf_token, (err, res, body) => {
				meta.config.allowedFileExtensions = oldValue;
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 200);
				assert(body && body.status && body.response && body.response.images);
				assert(Array.isArray(body.response.images));
				assert(body.response.images[0].url);
				done();
			});
		});

		it('should fail to upload image to post if image dimensions are too big', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/toobig.jpg'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 500);
				assert(body && body.status && body.status.message);
				assert.strictEqual(body.status.message, 'Input image exceeds pixel limit');
				done();
			});
		});

		it('should fail to upload image to post if image is broken', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/brokenimage.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 500);
				assert(body && body.status && body.status.message);
				assert(body.status.message.startsWith('pngload_buffer: non-recoverable state'));
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
				assert.strictEqual(err.message, 'Input file is missing');
				done();
			});
		});

		// it('should fail if topic thumbs are disabled', function (done) {
		// 	helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
		// 		assert.ifError(err);
		// 		assert.strictEqual(res.statusCode, 404);
		// 		console.log(body);
		// 		assert(body && body.status && body.status.code);
		// 		assert.strictEqual(body.status.code, '[[error:topic-thumbnails-are-disabled]]');
		// 		done();
		// 	});
		// });

		// it('should fail if file is not image', function (done) {
		// 	meta.config.allowTopicsThumbnail = 1;
		// 	helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/503.html'), {}, jar, csrf_token, function (err, res, body) {
		// 		assert.ifError(err);
		// 		assert.equal(res.statusCode, 500);
		// 		assert.equal(body.error, '[[error:invalid-file]]');
		// 		done();
		// 	});
		// });

		// it('should upload topic thumb', function (done) {
		// 	meta.config.allowTopicsThumbnail = 1;
		// 	helpers.uploadFile(nconf.get('url') + '/api/topic/thumb/upload', path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, function (err, res, body) {
		// 		assert.ifError(err);
		// 		assert.equal(res.statusCode, 200);
		// 		assert(Array.isArray(body));
		// 		assert(body[0].path);
		// 		assert(body[0].url);
		// 		done();
		// 	});
		// });

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

		it('should delete users uploads if account is deleted', (done) => {
			let jar;
			let uid;
			let url;
			const file = require('../src/file');

			async.waterfall([
				function (next) {
					user.create({ username: 'uploader', password: 'barbar' }, next);
				},
				function (_uid, next) {
					uid = _uid;
					helpers.loginUser('uploader', 'barbar', next);
				},
				function (jar, csrf_token, next) {
					helpers.uploadFile(`${nconf.get('url')}/api/post/upload`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, next);
				},
				function (res, body, next) {
					assert(body && body.status && body.response && body.response.images);
					assert(Array.isArray(body.response.images));
					assert(body.response.images[0].url);
					url = body.response.images[0].url;

					user.delete(1, uid, next);
				},
				function (userData, next) {
					const filePath = path.join(nconf.get('upload_path'), url.replace('/assets/uploads', ''));
					file.exists(filePath, next);
				},
				function (exists, next) {
					assert(!exists);
					done();
				},
			], done);
		});
	});

	describe('admin uploads', () => {
		let jar;
		let csrf_token;

		before((done) => {
			helpers.loginUser('admin', 'barbar', (err, _jar, _csrf_token) => {
				assert.ifError(err);
				jar = _jar;
				csrf_token = _csrf_token;
				done();
			});
		});

		it('should upload site logo', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadlogo`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/site-logo.png`);
				done();
			});
		});

		it('should fail to upload invalid file type', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/503.html'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(body.error, '[[error:invalid-image-type, image/png&#44; image/jpeg&#44; image/pjpeg&#44; image/jpg&#44; image/gif&#44; image/svg+xml]]');
				done();
			});
		});

		it('should fail to upload category image with invalid json params', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/test.png'), { params: 'invalid json' }, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(body.error, '[[error:invalid-json]]');
				done();
			});
		});

		it('should upload category image', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/category/uploadpicture`, path.join(__dirname, '../test/files/test.png'), { params: JSON.stringify({ cid: cid }) }, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/category/category-1.png`);
				done();
			});
		});

		it('should upload default avatar', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadDefaultAvatar`, path.join(__dirname, '../test/files/test.png'), { }, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/avatar-default.png`);
				done();
			});
		});

		it('should upload og image', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadOgImage`, path.join(__dirname, '../test/files/test.png'), { }, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(body[0].url, `${nconf.get('relative_path')}/assets/uploads/system/og-image.png`);
				done();
			});
		});

		it('should upload favicon', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadfavicon`, path.join(__dirname, '../test/files/favicon.ico'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/favicon.ico');
				done();
			});
		});

		it('should upload touch icon', (done) => {
			const touchiconAssetPath = '/assets/uploads/system/touchicon-orig.png';
			helpers.uploadFile(`${nconf.get('url')}/api/admin/uploadTouchIcon`, path.join(__dirname, '../test/files/test.png'), {}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, touchiconAssetPath);
				meta.config['brand:touchIcon'] = touchiconAssetPath;
				request(`${nconf.get('url')}/apple-touch-icon`, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body);
					done();
				});
			});
		});

		it('should upload regular file', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/upload/file`, path.join(__dirname, '../test/files/test.png'), {
				params: JSON.stringify({
					folder: 'system',
				}),
			}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(Array.isArray(body));
				assert.equal(body[0].url, '/assets/uploads/system/test.png');
				assert(file.existsSync(path.join(nconf.get('upload_path'), 'system', 'test.png')));
				done();
			});
		});

		it('should fail to upload regular file in wrong directory', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/admin/upload/file`, path.join(__dirname, '../test/files/test.png'), {
				params: JSON.stringify({
					folder: '../../system',
				}),
			}, jar, csrf_token, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 500);
				assert.strictEqual(body.error, '[[error:invalid-path]]');
				done();
			});
		});
	});
});
