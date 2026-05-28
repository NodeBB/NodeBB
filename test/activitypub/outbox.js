'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const controllers = require('../../src/controllers');
const middleware = require('../../src/middleware');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');

describe('Outbox', () => {
	let uid;
	let cid;
	let pid;
	let resBody;

	before(async () => {
		nconf.set('runJobs', 1);
	});

	after(async () => {
		nconf.set('runJobs', undefined);
	});

	beforeEach(async () => {
		uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
		const { postData } = await topics.post({
			uid,
			cid,
			title: utils.generateUUID(),
			content: utils.generateUUID(),
		});
		pid = postData.pid;
	});

	afterEach(async () => {
		resBody = null;
	});

	const collectResponse = (body) => {
		resBody = body;
		return {
			status: (code) => ({ json: (b) => collectResponse(b) }),
		};
	};

	describe('getOutbox', () => {
		it('should return something for an existing user with posts', async () => {
			const req = { params: { uid }, query: {} };
			const res = collectResponse();

			await controllers.activitypub.getOutbox(req, res);

			assert(resBody);
			assert(resBody.orderedItems);
			assert(resBody.orderedItems.length > 0);
		});

		it('should return in the expected ActivityPub format', async () => {
			const req = { params: { uid }, query: {} };
			const res = collectResponse();

			await controllers.activitypub.getOutbox(req, res);

			assert.strictEqual(resBody['@context'], 'https://www.w3.org/ns/activitystreams');
			assert.strictEqual(resBody.type, 'OrderedCollection');
			assert.strictEqual(resBody.id, `${nconf.get('url')}/uid/${uid}/outbox`);
			assert.strictEqual(resBody.totalItems, 1);
			assert(Array.isArray(resBody.orderedItems));
			assert.strictEqual(resBody.orderedItems.length, 1);

			const activity = resBody.orderedItems[0];
			assert.strictEqual(activity.type, 'Create');
			assert(['Note', 'Article'].includes(activity.object.type));
			assert.strictEqual(activity.actor, `${nconf.get('url')}/uid/${uid}`);
			assert.strictEqual(activity.object.url, `${nconf.get('url')}/post/${pid}`);
		});

		it('should not return anything for a non-existent user via middleware assertion', async () => {
			const nonExistentUid = '999999999';
			const userExists = await user.exists(nonExistentUid);
			assert(!userExists, 'User should not exist');

			const req = { params: { uid: nonExistentUid }, query: {} };
			let capturedCode;
			const res = {
				locals: {},
				req: { method: 'GET' },
				status: (code) => {
					capturedCode = code;
					return {
						json: () => res,
					};
				},
			};

			await middleware.assert.user(req, res, () => {});

			assert.strictEqual(capturedCode, 404);
		});

		it('should return an empty collection for a user with no activities', async () => {
			const emptyUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const req = { params: { uid: emptyUid }, query: {} };
			const res = collectResponse();

			await controllers.activitypub.getOutbox(req, res);

			assert(resBody);
			assert.strictEqual(resBody.type, 'OrderedCollection');
			assert.strictEqual(resBody.totalItems, 0);
			assert(Array.isArray(resBody.orderedItems));
			assert.strictEqual(resBody.orderedItems.length, 0);
		});

		it('should include upvote and downvote activities when present', async () => {
			// Upvote the post
			await posts.upvote(pid, uid);
			// Downvote another post (create a second post to downvote)
			const { postData: secondPost } = await topics.post({
				uid,
				cid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			await posts.downvote(secondPost.pid, uid);

			const req = { params: { uid }, query: {} };
			const res = collectResponse();

			await controllers.activitypub.getOutbox(req, res);

			assert(resBody.orderedItems.length >= 3);

			const types = resBody.orderedItems.map((a) => a.type);
			assert(types.includes('Create'));

			const upvoteActivities = resBody.orderedItems.filter(
				(a) => a.type === 'Like' && a.object.type === 'Note'
			);
			assert(upvoteActivities.length >= 1);

			const dislikeActivities = resBody.orderedItems.filter(
				(a) => a.type === 'Dislike' && a.object.type === 'Note'
			);
			assert(dislikeActivities.length >= 1);
		});

		it('should paginate when there are more than 20 items', async () => {
			// Create 25 posts
			for (let i = 0; i < 25; i++) {
				await topics.post({
					uid,
					cid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
			}

			const req = { params: { uid }, query: {} };
			const res = collectResponse();

			await controllers.activitypub.getOutbox(req, res);

			assert.strictEqual(resBody.type, 'OrderedCollectionPage');
			assert.strictEqual(resBody.totalItems, 26);
			assert(resBody.orderedItems.length <= 20);
			assert(resBody.first);
			assert(resBody.last);
			assert(resBody.partOf);
		});
	});
});
