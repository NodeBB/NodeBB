'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const nconf = require('nconf');
const async = require('async');
const crypto = require('crypto');

const db = require('../mocks/databasemock');

const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const user = require('../../src/user');
const meta = require('../../src/meta');
const file = require('../../src/file');
const utils = require('../../public/src/utils');

const _filenames = ['abracadabra.png', 'shazam.jpg', 'whoa.gif', 'amazeballs.jpg', 'wut.txt', 'test.bmp'];
const _recreateFiles = () => {
	// Create stub files for testing
	_filenames.forEach(filename => fs.closeSync(fs.openSync(path.join(nconf.get('upload_path'), 'files', filename), 'w')));
};

describe('upload methods', () => {
	let pid;
	let purgePid;
	let cid;
	let uid;

	before(async () => {
		_recreateFiles();

		uid = await user.create({
			username: 'uploads user',
			password: 'abracadabra',
			gdpr_consent: 1,
		});

		({ cid } = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		}));

		const topicPostData = await topics.post({
			uid,
			cid,
			title: 'topic with some images',
			content: 'here is an image [alt text](/assets/uploads/files/abracadabra.png) and another [alt text](/assets/uploads/files/shazam.jpg)',
		});
		pid = topicPostData.postData.pid;

		const purgePostData = await topics.post({
			uid,
			cid,
			title: 'topic with some images, to be purged',
			content: 'here is an image [alt text](/assets/uploads/files/whoa.gif) and another [alt text](/assets/uploads/files/amazeballs.jpg)',
		});
		purgePid = purgePostData.postData.pid;
	});

	describe('.sync()', () => {
		it('should properly add new images to the post\'s zset', (done) => {
			posts.uploads.sync(pid, (err) => {
				assert.ifError(err);

				db.sortedSetCard(`post:${pid}:uploads`, (err, length) => {
					assert.ifError(err);
					assert.strictEqual(length, 2);
					done();
				});
			});
		});

		it('should remove an image if it is edited out of the post', (done) => {
			async.series([
				function (next) {
					posts.edit({
						pid: pid,
						uid,
						content: 'here is an image [alt text](/assets/uploads/files/abracadabra.png)... AND NO MORE!',
					}, next);
				},
				async.apply(posts.uploads.sync, pid),
			], (err) => {
				assert.ifError(err);
				db.sortedSetCard(`post:${pid}:uploads`, (err, length) => {
					assert.ifError(err);
					assert.strictEqual(1, length);
					done();
				});
			});
		});
	});

	describe('.list()', () => {
		it('should display the uploaded files for a specific post', (done) => {
			posts.uploads.list(pid, (err, uploads) => {
				assert.ifError(err);
				assert.equal(true, Array.isArray(uploads));
				assert.strictEqual(1, uploads.length);
				assert.equal('string', typeof uploads[0]);
				done();
			});
		});
	});

	describe('.isOrphan()', () => {
		it('should return false if upload is not an orphan', (done) => {
			posts.uploads.isOrphan('files/abracadabra.png', (err, isOrphan) => {
				assert.ifError(err);
				assert.equal(isOrphan, false);
				done();
			});
		});

		it('should return true if upload is an orphan', (done) => {
			posts.uploads.isOrphan('files/shazam.jpg', (err, isOrphan) => {
				assert.ifError(err);
				assert.equal(true, isOrphan);
				done();
			});
		});
	});

	describe('.associate()', () => {
		it('should add an image to the post\'s maintained list of uploads', (done) => {
			async.waterfall([
				async.apply(posts.uploads.associate, pid, 'files/whoa.gif'),
				async.apply(posts.uploads.list, pid),
			], (err, uploads) => {
				assert.ifError(err);
				assert.strictEqual(2, uploads.length);
				assert.strictEqual(true, uploads.includes('files/whoa.gif'));
				done();
			});
		});

		it('should allow arrays to be passed in', (done) => {
			async.waterfall([
				async.apply(posts.uploads.associate, pid, ['files/amazeballs.jpg', 'files/wut.txt']),
				async.apply(posts.uploads.list, pid),
			], (err, uploads) => {
				assert.ifError(err);
				assert.strictEqual(4, uploads.length);
				assert.strictEqual(true, uploads.includes('files/amazeballs.jpg'));
				assert.strictEqual(true, uploads.includes('files/wut.txt'));
				done();
			});
		});

		it('should save a reverse association of md5sum to pid', (done) => {
			const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

			async.waterfall([
				async.apply(posts.uploads.associate, pid, ['files/test.bmp']),
				function (next) {
					db.getSortedSetRange(`upload:${md5('files/test.bmp')}:pids`, 0, -1, next);
				},
			], (err, pids) => {
				assert.ifError(err);
				assert.strictEqual(true, Array.isArray(pids));
				assert.strictEqual(true, pids.length > 0);
				assert.equal(pid, pids[0]);
				done();
			});
		});

		it('should not associate a file that does not exist on the local disk', (done) => {
			async.waterfall([
				async.apply(posts.uploads.associate, pid, ['files/nonexistant.xls']),
				async.apply(posts.uploads.list, pid),
			], (err, uploads) => {
				assert.ifError(err);
				assert.strictEqual(uploads.length, 5);
				assert.strictEqual(false, uploads.includes('files/nonexistant.xls'));
				done();
			});
		});
	});

	describe('.dissociate()', () => {
		it('should remove an image from the post\'s maintained list of uploads', (done) => {
			async.waterfall([
				async.apply(posts.uploads.dissociate, pid, 'files/whoa.gif'),
				async.apply(posts.uploads.list, pid),
			], (err, uploads) => {
				assert.ifError(err);
				assert.strictEqual(4, uploads.length);
				assert.strictEqual(false, uploads.includes('files/whoa.gif'));
				done();
			});
		});

		it('should allow arrays to be passed in', (done) => {
			async.waterfall([
				async.apply(posts.uploads.dissociate, pid, ['files/amazeballs.jpg', 'files/wut.txt']),
				async.apply(posts.uploads.list, pid),
			], (err, uploads) => {
				assert.ifError(err);
				assert.strictEqual(2, uploads.length);
				assert.strictEqual(false, uploads.includes('files/amazeballs.jpg'));
				assert.strictEqual(false, uploads.includes('files/wut.txt'));
				done();
			});
		});

		it('should remove the image\'s user association, if present', async () => {
			_recreateFiles();
			await posts.uploads.associate(pid, 'files/wut.txt');
			await user.associateUpload(uid, 'files/wut.txt');
			await posts.uploads.dissociate(pid, 'files/wut.txt');

			const userUploads = await db.getSortedSetMembers(`uid:${uid}:uploads`);
			assert.strictEqual(userUploads.includes('files/wut.txt'), false);
		});
	});

	describe('.dissociateAll()', () => {
		it('should remove all images from a post\'s maintained list of uploads', async () => {
			await posts.uploads.dissociateAll(pid);
			const uploads = await posts.uploads.list(pid);

			assert.equal(uploads.length, 0);
		});
	});

	describe('Dissociation on purge', () => {
		it('should not dissociate images on post deletion', async () => {
			await posts.delete(purgePid, 1);
			const uploads = await posts.uploads.list(purgePid);

			assert.equal(uploads.length, 2);
		});

		it('should dissociate images on post purge', async () => {
			await posts.purge(purgePid, 1);
			const uploads = await posts.uploads.list(purgePid);

			assert.equal(uploads.length, 0);
		});
	});

	describe('Deletion from disk on purge', () => {
		let postData;

		beforeEach(async () => {
			_recreateFiles();

			({ postData } = await topics.post({
				uid,
				cid,
				title: 'Testing deletion from disk on purge',
				content: 'these images: ![alt text](/assets/uploads/files/abracadabra.png) and another ![alt text](/assets/uploads/files/test.bmp)',
			}));
		});

		afterEach(async () => {
			await topics.purge(postData.tid, uid);
		});

		it('should purge the images from disk if the post is purged', async () => {
			await posts.purge(postData.pid, uid);
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files', 'abracadabra.png')), false);
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files', 'test.bmp')), false);
		});

		it('should leave the images behind if `preserveOrphanedUploads` is enabled', async () => {
			meta.config.preserveOrphanedUploads = 1;

			await posts.purge(postData.pid, uid);
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files', 'abracadabra.png')), true);
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files', 'test.bmp')), true);

			delete meta.config.preserveOrphanedUploads;
		});

		it('should leave images behind if they are used in another post', async () => {
			const { postData: secondPost } = await topics.post({
				uid,
				cid,
				title: 'Second topic',
				content: 'just abracadabra: ![alt text](/assets/uploads/files/abracadabra.png)',
			});

			await posts.purge(secondPost.pid, uid);
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files', 'abracadabra.png')), true);
		});
	});

	describe('.deleteFromDisk()', () => {
		beforeEach(() => {
			_recreateFiles();
		});

		it('should work if you pass in a string path', async () => {
			await posts.uploads.deleteFromDisk('files/abracadabra.png');
			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files/abracadabra.png')), false);
		});

		it('should throw an error if a non-string or non-array is passed', async () => {
			try {
				await posts.uploads.deleteFromDisk({
					files: ['files/abracadabra.png'],
				});
			} catch (err) {
				assert(!!err);
				assert.strictEqual(err.message, '[[error:wrong-parameter-type, filePaths, object, array]]');
			}
		});

		it('should delete the files passed in, from disk', async () => {
			await posts.uploads.deleteFromDisk(['files/abracadabra.png', 'files/shazam.jpg']);

			const existsOnDisk = await Promise.all(_filenames.map(async (filename) => {
				const fullPath = path.resolve(nconf.get('upload_path'), 'files', filename);
				return file.exists(fullPath);
			}));

			assert.deepStrictEqual(existsOnDisk, [false, false, true, true, true, true]);
		});

		it('should not delete files if they are not in `uploads/files/` (path traversal)', async () => {
			const tmpFilePath = path.resolve(os.tmpdir(), `derp${utils.generateUUID()}`);
			await fs.promises.appendFile(tmpFilePath, '');
			await posts.uploads.deleteFromDisk(['../files/503.html', tmpFilePath]);

			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), '../files/503.html')), true);
			assert.strictEqual(await file.exists(tmpFilePath), true);

			await file.delete(tmpFilePath);
		});

		it('should delete files even if they are not orphans', async () => {
			await topics.post({
				uid,
				cid,
				title: 'To be orphaned',
				content: 'this image is not an orphan: ![wut](/assets/uploads/files/wut.txt)',
			});

			assert.strictEqual(await posts.uploads.isOrphan('files/wut.txt'), false);
			await posts.uploads.deleteFromDisk(['files/wut.txt']);

			assert.strictEqual(await file.exists(path.resolve(nconf.get('upload_path'), 'files/wut.txt')), false);
		});
	});
});

describe('post uploads management', () => {
	let topic;
	let reply;
	let uid;
	let cid;

	before(async () => {
		_recreateFiles();

		uid = await user.create({
			username: 'uploads user',
			password: 'abracadabra',
			gdpr_consent: 1,
		});

		({ cid } = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		}));

		const topicPostData = await topics.post({
			uid,
			cid,
			title: 'topic to test uploads with',
			content: '[abcdef](/assets/uploads/files/abracadabra.png)',
		});

		const replyData = await topics.reply({
			uid,
			tid: topicPostData.topicData.tid,
			timestamp: Date.now(),
			content: '[abcdef](/assets/uploads/files/shazam.jpg)',
		});

		topic = topicPostData;
		reply = replyData;
	});

	it('should automatically sync uploads on topic create and reply', (done) => {
		db.sortedSetsCard([`post:${topic.topicData.mainPid}:uploads`, `post:${reply.pid}:uploads`], (err, lengths) => {
			assert.ifError(err);
			assert.strictEqual(lengths[0], 1);
			assert.strictEqual(lengths[1], 1);
			done();
		});
	});

	it('should automatically sync uploads on post edit', (done) => {
		async.waterfall([
			async.apply(posts.edit, {
				pid: reply.pid,
				uid,
				content: 'no uploads',
			}),
			function (postData, next) {
				posts.uploads.list(reply.pid, next);
			},
		], (err, uploads) => {
			assert.ifError(err);
			assert.strictEqual(true, Array.isArray(uploads));
			assert.strictEqual(0, uploads.length);
			done();
		});
	});
});
