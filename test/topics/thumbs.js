'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');

const meta = require('../../src/meta');
const user = require('../../src/user');
const groups = require('../../src/groups');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const categories = require('../../src/categories');
const plugins = require('../../src/plugins');
const file = require('../../src/file');
const utils = require('../../src/utils');

const helpers = require('../helpers');

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
		fs.closeSync(fs.openSync(path.resolve(__dirname, '../uploads', thumbPaths[0]), 'w'));
		fs.closeSync(fs.openSync(path.resolve(__dirname, '../uploads', thumbPaths[1]), 'w'));
	}

	before(async () => {
		meta.config.allowTopicsThumbnail = 1;

		adminUid = await user.create({ username: 'admin', password: '123456' });
		fooUid = await user.create({ username: 'foo', password: '123456' });
		await groups.join('administrators', adminUid);
		const adminLogin = await helpers.loginUser('admin', '123456');
		adminJar = adminLogin.jar;
		adminCSRF = adminLogin.csrf_token;
		const fooLogin = await helpers.loginUser('foo', '123456');
		fooJar = fooLogin.jar;
		fooCSRF = fooLogin.csrf_token;

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
		await db.sortedSetAdd(`topic:${topicObj.topicData.tid}:thumbs`, 0, `${relativeThumbPaths[0]}`);
	});

	it('should return bool for whether a thumb exists', async () => {
		const exists = await topics.thumbs.exists(topicObj.topicData.tid, `${relativeThumbPaths[0]}`);
		assert.strictEqual(exists, true);
	});

	describe('.get()', () => {
		it('should return an array of thumbs', async () => {
			require('../../src/cache').del(`topic:${topicObj.topicData.tid}:thumbs`);
			const thumbs = await topics.thumbs.get(topicObj.topicData.tid);
			assert.deepStrictEqual(thumbs, [{
				id: topicObj.topicData.tid,
				name: 'test.png',
				path: `${relativeThumbPaths[0]}`,
				url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[0]}`,
			}]);
		});

		it('should return an array of an array of thumbs if multiple tids are passed in', async () => {
			const thumbs = await topics.thumbs.get([topicObj.topicData.tid, topicObj.topicData.tid + 1]);
			assert.deepStrictEqual(thumbs, [
				[{
					id: topicObj.topicData.tid,
					name: 'test.png',
					path: `${relativeThumbPaths[0]}`,
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

			const exists = await db.isSortedSetMember(`topic:${tid}:thumbs`, relativeThumbPaths[0]);
			assert(exists);
		});

		it('should also work with UUIDs', async () => {
			await topics.thumbs.associate({
				id: uuid,
				path: relativeThumbPaths[1],
				score: 5,
			});

			const exists = await db.isSortedSetMember(`draft:${uuid}:thumbs`, relativeThumbPaths[1]);
			assert(exists);
		});

		it('should also work with a URL', async () => {
			await topics.thumbs.associate({
				id: tid,
				path: relativeThumbPaths[2],
			});

			const exists = await db.isSortedSetMember(`topic:${tid}:thumbs`, relativeThumbPaths[2]);
			assert(exists);
		});

		it('should have a score equal to the number of thumbs prior to addition', async () => {
			const scores = await db.sortedSetScores(`topic:${tid}:thumbs`, [relativeThumbPaths[0], relativeThumbPaths[2]]);
			assert.deepStrictEqual(scores, [0, 1]);
		});

		it('should update the relevant topic hash with the number of thumbnails', async () => {
			const numThumbs = await topics.getTopicField(tid, 'numThumbs');
			assert.strictEqual(parseInt(numThumbs, 10), 2);
		});

		it('should successfully associate a thumb with a topic even if it already contains that thumbnail (updates score)', async () => {
			await topics.thumbs.associate({
				id: tid,
				path: relativeThumbPaths[0],
			});

			const score = await db.sortedSetScore(`topic:${tid}:thumbs`, relativeThumbPaths[0]);

			assert(isFinite(score)); // exists in set
			assert.strictEqual(score, 2);
		});

		it('should update the score to be passed in as the third argument', async () => {
			await topics.thumbs.associate({
				id: tid,
				path: relativeThumbPaths[0],
				score: 0,
			});

			const score = await db.sortedSetScore(`topic:${tid}:thumbs`, relativeThumbPaths[0]);

			assert(isFinite(score)); // exists in set
			assert.strictEqual(score, 0);
		});

		it('should associate the thumbnail with that topic\'s main pid\'s uploads', async () => {
			const uploads = await posts.uploads.list(mainPid);
			assert(uploads.includes(relativeThumbPaths[0]));
		});

		it('should maintain state in the topic\'s main pid\'s uploads if posts.uploads.sync() is called', async () => {
			await posts.uploads.sync(mainPid);
			const uploads = await posts.uploads.list(mainPid);
			assert(uploads.includes(relativeThumbPaths[0]));
		});

		it('should combine the thumbs uploaded to a UUID zset and combine it with a topic\'s thumb zset', async () => {
			await topics.thumbs.migrate(uuid, tid);

			const thumbs = await topics.thumbs.get(tid);
			assert.strictEqual(thumbs.length, 3);
			assert.deepStrictEqual(thumbs, [
				{
					id: tid,
					name: 'test.png',
					path: relativeThumbPaths[0],
					url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[0]}`,
				},
				{
					id: tid,
					name: 'example.org',
					path: 'https://example.org',
					url: 'https://example.org',
				},
				{
					id: tid,
					name: 'test2.png',
					path: relativeThumbPaths[1],
					url: `${nconf.get('relative_path')}${nconf.get('upload_url')}${relativeThumbPaths[1]}`,
				},
			]);
		});
	});

	describe(`.delete()`, () => {
		it('should remove a file from sorted set', async () => {
			await topics.thumbs.associate({
				id: 1,
				path: `/files/test.png`,
			});
			await topics.thumbs.delete(1, `/files/test.png`);

			assert.strictEqual(await db.isSortedSetMember('topic:1:thumbs', '/files/test.png'), false);
		});

		it('should no longer be associated with that topic\'s main pid\'s uploads', async () => {
			const mainPid = (await topics.getMainPids([1]))[0];
			const uploads = await posts.uploads.list(mainPid);
			assert(!uploads.includes(path.basename(relativeThumbPaths[0])));
		});

		it('should also work with UUIDs', async () => {
			await topics.thumbs.associate({
				id: uuid,
				path: `/files/test.png`,
			});
			await topics.thumbs.delete(uuid, '/files/test.png');

			assert.strictEqual(await db.isSortedSetMember(`draft:${uuid}:thumbs`, '/files/test.png'), false);
			assert.strictEqual(await file.exists(path.join(`${nconf.get('upload_path')}`, '/files/test.png')), false);
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

		it('should have no more thumbs left', async () => {
			const associated = await db.isSortedSetMembers(`topic:1:thumbs`, [relativeThumbPaths[0], relativeThumbPaths[1]]);
			assert.strictEqual(associated.some(Boolean), false);
		});

		it('should decrement numThumbs if dissociated one by one', async () => {
			console.log('before', await db.getSortedSetRange(`topic:1:thumbs`, 0, -1));
			await topics.thumbs.associate({ id: 1, path: `${nconf.get('relative_path')}${nconf.get('upload_url')}/files/test.png` });
			await topics.thumbs.associate({ id: 1, path: `${nconf.get('relative_path')}${nconf.get('upload_url')}/files/test2.png` });

			await topics.thumbs.delete(1, [relativeThumbPaths[0]]);
			let numThumbs = parseInt(await db.getObjectField('topic:1', 'numThumbs'), 10);
			assert.strictEqual(numThumbs, 1);

			await topics.thumbs.delete(1, [relativeThumbPaths[1]]);
			numThumbs = parseInt(await db.getObjectField('topic:1', 'numThumbs'), 10);
			assert.strictEqual(numThumbs, 0);
		});
	});

	describe('.deleteAll()', () => {
		before(async () => {
			await Promise.all([
				topics.thumbs.associate({ id: 1, path: '/files/test.png' }),
				topics.thumbs.associate({ id: 1, path: '/files/test2.png' }),
			]);
			createFiles();
		});

		it('should have thumbs prior to tests', async () => {
			const associated = await db.isSortedSetMembers(
				`topic:1:thumbs`, ['/files/test.png', '/files/test2.png']
			);
			assert.strictEqual(associated.every(Boolean), true);
		});

		it('should not error out', async () => {
			await topics.thumbs.deleteAll(1);
		});

		it('should remove all associated thumbs with that topic', async () => {
			const associated = await db.isSortedSetMembers(
				`topic:1:thumbs`, ['/files/test.png', '/files/test2.png']
			);
			assert.strictEqual(associated.some(Boolean), false);
		});

		it('should no longer have a :thumbs zset', async () => {
			assert.strictEqual(await db.exists('topic:1:thumbs'), false);
		});
	});

	describe('HTTP calls to topic thumb routes', () => {
		before(() => {
			createFiles();
		});

		it('should succeed with a valid tid', async () => {
			const { response } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/1/thumbs`, path.join(__dirname, '../files/test.png'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 200);
		});

		it('should succeed with a uuid', async () => {
			const { response } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, '../files/test.png'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 200);
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

			const { response } = await helpers.uploadFile(
				`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`,
				path.join(__dirname, '../files/test.png'),
				{},
				adminJar,
				adminCSRF
			);
			assert.strictEqual(response.statusCode, 200);

			await plugins.hooks.unregister('test', 'filter:uploadFile', hookMethod);
		});

		it('should fail with a non-existant tid', async () => {
			const { response } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${Number.MAX_SAFE_INTEGER}/thumbs`, path.join(__dirname, '../files/test.png'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 404);
		});

		it('should fail when garbage is passed in', async () => {
			const { response } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/abracadabra/thumbs`, path.join(__dirname, '../files/test.png'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 404);
		});

		it('should fail when calling user cannot edit the tid', async () => {
			const { response } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/2/thumbs`, path.join(__dirname, '../files/test.png'), {}, fooJar, fooCSRF);
			assert.strictEqual(response.statusCode, 403);
		});

		it('should fail if thumbnails are not enabled', async () => {
			meta.config.allowTopicsThumbnail = 0;

			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, '../files/test.png'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 503);
			assert(body && body.status);
			assert.strictEqual(body.status.message, 'Topic thumbnails are disabled.');
		});

		it('should fail if file is not image', async () => {
			meta.config.allowTopicsThumbnail = 1;

			const { response, body } = await helpers.uploadFile(`${nconf.get('url')}/api/v3/topics/${uuid}/thumbs`, path.join(__dirname, '../files/503.html'), {}, adminJar, adminCSRF);
			assert.strictEqual(response.statusCode, 500);
			assert(body && body.status);
			assert.strictEqual(body.status.message, 'Invalid File');
		});
	});

	describe('behaviour on topic purge', () => {
		let topicObj;

		before(async () => {
			topicObj = await topics.post({
				uid: adminUid,
				cid: categoryObj.cid,
				title: 'Test Topic Title',
				content: 'The content of test topic',
			});

			await Promise.all([
				topics.thumbs.associate({ id: topicObj.tid, path: thumbPaths[0] }),
				topics.thumbs.associate({ id: topicObj.tid, path: thumbPaths[1] }),
			]);
			createFiles();

			await topics.purge(topicObj.tid, adminUid);
		});

		it('should no longer have a :thumbs zset', async () => {
			assert.strictEqual(await db.exists(`topic:${topicObj.tid}:thumbs`), false);
		});

		it('should not leave post upload associations behind', async () => {
			const uploads = await db.getSortedSetMembers(`post:${topicObj.postData.pid}:uploads`);
			assert.strictEqual(uploads.length, 0);
		});
	});
});
