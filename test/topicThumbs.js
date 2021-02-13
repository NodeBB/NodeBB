'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const nconf = require('nconf');
const request = require('request-promise-native');

const db = require('./mocks/databasemock');

const meta = require('../src/meta');
const user = require('../src/user');
const groups = require('../src/groups');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const plugins = require('../src/plugins');
const file = require('../src/file');
const utils = require('../src/utils');

const helpers = require('./helpers');

describe('Topic thumbs', () => {
	let topicObj;
	let categoryObj;
	let adminUid;
	let adminJar;
	let adminCSRF;
	let fooJar;
	let fooCSRF;
	let fooUid;
	const thumbPaths = [
		`${nconf.get('upload_path')}/files/test.png`,
		`${nconf.get('upload_path')}/files/test2.png`,
		'https://example.org',
	];
	const relativeThumbPaths = thumbPaths.map(path => path.replace(nconf.get('upload_path'), ''));
	const uuid = utils.generateUUID();

	function createFiles() {
		fs.closeSync(fs.openSync(path.resolve(__dirname, './uploads', thumbPaths[0]), 'w'));
		fs.closeSync(fs.openSync(path.resolve(__dirname, './uploads', thumbPaths[1]), 'w'));
	}

	before(async () => {
		meta.config.allowTopicsThumbnail = 1;

		adminUid = await user.create({ username: 'admin', password: '123456' });
		fooUid = await user.create({ username: 'foo', password: '123456' });
		await groups.join('administrators', adminUid);
		({ adminJar, adminCSRF } = await new Promise((resolve, reject) => {
			helpers.loginUser('admin', '123456', (err, adminJar, adminCSRF) => {
				if (err) {
					return reject(err);
				}

				resolve({ adminJar, adminCSRF });
			});
		}));
		({ fooJar, fooCSRF } = await new Promise((resolve, reject) => {
			helpers.loginUser('foo', '123456', (err, fooJar, fooCSRF) => {
				if (err) {
					return reject(err);
				}

				resolve({ fooJar, fooCSRF });
			});
		}));

		categoryObj = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		topicObj = await topics.post({
			uid: adminUid,
			cid: categoryObj.cid,
			title: 'Test Topic Title',
			content: 'The content of test topic',
		});

		// Touch a couple files and associate it to a topic
		createFiles();
		await db.sortedSetAdd(`topic:${topicObj.topicData.tid}:thumbs`, 0, `/${relativeThumbPaths[0]}`);
	});

	it('should return bool for whether a thumb exists', async () => {
		const exists = await topics.thumbs.exists(topicObj.topicData.tid, `/${relativeThumbPaths[0]}`);
		assert.strictEqual(exists, true);
	});

	describe('.get()', () => {
		it('should return an array of thumbs', async () => {
			require('../src/cache').del(`topic:${topicObj.topicData.tid}:thumbs`);
			const thumbs = await topics.thumbs.get(topicObj.topicData.tid);
			assert.deepStrictEqual(thumbs, [{
				id: 1,
				name: 'test.png',
				url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[0]}`,
			}]);
		});

		it('should return an array of an array of thumbs if multiple tids are passed in', async () => {
			const thumbs = await topics.thumbs.get([topicObj.topicData.tid, topicObj.topicData.tid + 1]);
			assert.deepStrictEqual(thumbs, [
				[{
					id: 1,
					name: 'test.png',
					url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[0]}`,
				}],
				[],
			]);
		});
	});

	describe('.associate()', () => {
		let tid;
		let mainPid;

		before(async () => {
			topicObj = await topics.post({
				uid: adminUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			});
			tid = topicObj.topicData.tid;
			mainPid = topicObj.postData.pid;
		});

		it('should add an uploaded file to a zset', async () => {
			await topics.thumbs.associate({
				id: tid,
				path: relativeThumbPaths[0],
			});

			const exists = await db.isSortedSetMember(`topic:2:thumbs`, relativeThumbPaths[0]);
			assert(exists);
		});

		it('should also work with UUIDs', async () => {
			await topics.thumbs.associate({
				id: uuid,
				path: relativeThumbPaths[1],
			});

			const exists = await db.isSortedSetMember(`draft:${uuid}:thumbs`, relativeThumbPaths[1]);
			assert(exists);
		});

		it('should also work with a URL', async () => {
			await topics.thumbs.associate({
				id: tid,
				path: relativeThumbPaths[2],
			});

			const exists = await db.isSortedSetMember(`topic:2:thumbs`, relativeThumbPaths[2]);
			assert(exists);
		});

		it('should have a score equal to the number of thumbs prior to addition', async () => {
			const scores = await db.sortedSetScores('topic:2:thumbs', [relativeThumbPaths[0], relativeThumbPaths[2]]);
			assert.deepStrictEqual(scores, [0, 1]);
		});

		it('should update the relevant topic hash with the number of thumbnails', async () => {
			const numThumbs = await topics.getTopicField(2, 'numThumbs');
			assert.strictEqual(parseInt(numThumbs, 10), 2);
		});

		it('should associate the thumbnail with that topic\'s main pid\'s uploads', async () => {
			const uploads = await posts.uploads.list(mainPid);
			assert(uploads.includes(path.basename(relativeThumbPaths[0])));
		});

		it('should maintain state in the topic\'s main pid\'s uploads if posts.uploads.sync() is called', async () => {
			await posts.uploads.sync(mainPid);
			const uploads = await posts.uploads.list(mainPid);
			assert(uploads.includes(path.basename(relativeThumbPaths[0])));
		});
	});

	describe('.migrate()', () => {
		it('should combine the thumbs uploaded to a UUID zset and combine it with a topic\'s thumb zset', async () => {
			await topics.thumbs.migrate(uuid, 2);

			const thumbs = await topics.thumbs.get(2);
			assert.strictEqual(thumbs.length, 3);
			assert.deepStrictEqual(thumbs, [
				{
					id: 2,
					name: 'test.png',
					url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[0]}`,
				},
				{
					id: 2,
					name: 'example.org',
					url: 'https://example.org',
				},
				{
					id: 2,
					name: 'test2.png',
					url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[1]}`,
				},
			]);
		});
	});

	describe(`.delete()`, () => {
		it('should remove a file from sorted set AND disk', async () => {
			await topics.thumbs.associate({
				id: 1,
				path: thumbPaths[0],
			});
			await topics.thumbs.delete(1, relativeThumbPaths[0]);

			assert.strictEqual(await db.isSortedSetMember('topic:1:thumbs', relativeThumbPaths[0]), false);
			assert.strictEqual(await file.exists(thumbPaths[0]), false);
		});

		it('should no longer be associated with that topic\'s main pid\'s uploads', async () => {
			const mainPid = (await topics.getMainPids([1]))[0];
			const uploads = await posts.uploads.list(mainPid);
			assert(!uploads.includes(path.basename(relativeThumbPaths[0])));
		});

		it('should also work with UUIDs', async () => {
			await topics.thumbs.associate({
				id: uuid,
				path: thumbPaths[1],
			});
			await topics.thumbs.delete(uuid, relativeThumbPaths[1]);

			assert.strictEqual(await db.isSortedSetMember(`draft:${uuid}:thumbs`, relativeThumbPaths[1]), false);
			assert.strictEqual(await file.exists(thumbPaths[1]), false);
		});

		it('should also work with URLs', async () => {
			await topics.thumbs.associate({
				id: uuid,
				path: thumbPaths[2],
			});
			await topics.thumbs.delete(uuid, relativeThumbPaths[2]);

			assert.strictEqual(await db.isSortedSetMember(`draft:${uuid}:thumbs`, relativeThumbPaths[2]), false);
		});

		it('should not delete the file from disk if not associated with the tid', async () => {
			createFiles();
			await topics.thumbs.delete(uuid, thumbPaths[0]);
			assert.strictEqual(await file.exists(thumbPaths[0]), true);
		});
	});

	describe('HTTP calls to topic thumb routes', () => {
		before(() => {
			createFiles();
		});

		it('should succeed with a valid tid', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/1/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 200);
				done();
			});
		});

		it('should succeed with a uuid', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 200);
				done();
			});
		});

		it('should succeed with uploader plugins', async () => {
			const hookMethod = async () => ({
				name: 'test.png',
				url: 'https://example.org',
			});
			await plugins.hooks.register('test', {
				hook: 'filter:uploadFile',
				method: hookMethod,
			});

			await new Promise((resolve) => {
				helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
					assert.ifError(err);
					assert.strictEqual(res.statusCode, 200);
					resolve();
				});
			});

			await plugins.hooks.unregister('test', 'filter:uploadFile', hookMethod);
		});

		it('should fail with a non-existant tid', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/3/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 404);
				done();
			});
		});

		it('should fail when garbage is passed in', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/abracadabra/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 404);
				done();
			});
		});

		it('should fail when calling user cannot edit the tid', (done) => {
			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/1/thumbs`, path.join(__dirname, './files/test.png'), {}, fooJar, fooCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 403);
				done();
			});
		});

		it('should fail if thumbnails are not enabled', (done) => {
			meta.config.allowTopicsThumbnail = 0;

			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, './files/test.png'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 503);
				assert(body && body.status);
				assert.strictEqual(body.status.message, '[[error:topic-thumbnails-are-disabled]]');
				done();
			});
		});

		it('should fail if file is not image', (done) => {
			meta.config.allowTopicsThumbnail = 1;

			helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, './files/503.html'), {}, adminJar, adminCSRF, (err, res, body) => {
				assert.ifError(err);
				assert.strictEqual(res.statusCode, 500);
				assert(body && body.status);
				assert.strictEqual(body.status.message, '[[error:invalid-file]]');
				done();
			});
		});
	});
});
