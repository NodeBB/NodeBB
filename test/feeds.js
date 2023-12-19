'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const request = require('../src/request');
const topics = require('../src/topics');
const categories = require('../src/categories');
const user = require('../src/user');
const meta = require('../src/meta');
const privileges = require('../src/privileges');
const helpers = require('./helpers');

describe('feeds', () => {
	let tid;
	let fooUid;
	let cid;
	before(async () => {
		meta.config['feeds:disableRSS'] = 1;
		const category = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		cid = category.cid;
		fooUid = await user.create({ username: 'foo', password: 'barbar', email: 'foo@test.com' });

		const result = await topics.post({
			cid: cid,
			uid: fooUid,
			title: 'test topic title',
			content: 'test topic content',
		});
		tid = result.topicData.tid;
	});

	it('should 404', async () => {
		const feedUrls = [
			`${nconf.get('url')}/topic/${tid}.rss`,
			`${nconf.get('url')}/category/${cid}.rss`,
			`${nconf.get('url')}/topics.rss`,
			`${nconf.get('url')}/recent.rss`,
			`${nconf.get('url')}/top.rss`,
			`${nconf.get('url')}/popular.rss`,
			`${nconf.get('url')}/popular/day.rss`,
			`${nconf.get('url')}/recentposts.rss`,
			`${nconf.get('url')}/category/${cid}/recentposts.rss`,
			`${nconf.get('url')}/user/foo/topics.rss`,
			`${nconf.get('url')}/tags/nodebb.rss`,
		];
		for (const url of feedUrls) {
			// eslint-disable-next-line no-await-in-loop
			const { response } = await request.get(url);
			assert.equal(response.statusCode, 404);
		}
		meta.config['feeds:disableRSS'] = 0;
	});

	it('should 404 if topic does not exist', async () => {
		const { response } = await request.get(`${nconf.get('url')}/topic/${1000}.rss`);
		assert.equal(response.statusCode, 404);
	});

	it('should 404 if category id is not a number', async () => {
		const { response } = await request.get(`${nconf.get('url')}/category/invalid.rss`);
		assert.equal(response.statusCode, 404);
	});

	it('should redirect if we do not have read privilege', async () => {
		await privileges.categories.rescind(['groups:topics:read'], cid, 'guests');
		const { response, body } = await request.get(`${nconf.get('url')}/topic/${tid}.rss`);
		assert.equal(response.statusCode, 200);
		assert(body);
		assert(body.includes('Login to your account'));
		await privileges.categories.give(['groups:topics:read'], cid, 'guests');
	});

	it('should 404 if user is not found', async () => {
		const { response } = await request.get(`${nconf.get('url')}/user/doesnotexist/topics.rss`);
		assert.equal(response.statusCode, 404);
	});

	it('should redirect if we do not have read privilege', async () => {
		await privileges.categories.rescind(['groups:read'], cid, 'guests');
		const { response, body } = await request.get(`${nconf.get('url')}/category/${cid}.rss`);
		assert.equal(response.statusCode, 200);
		assert(body);
		assert(body.includes('Login to your account'));
		await privileges.categories.give(['groups:read'], cid, 'guests');
	});

	describe('private feeds and tokens', () => {
		let jar;
		let rssToken;
		before(async () => {
			({ jar } = await helpers.loginUser('foo', 'barbar'));
		});

		it('should load feed if its not private', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/category/${cid}.rss`);
			assert.equal(response.statusCode, 200);
			assert(body);
		});


		it('should not allow access if uid or token is missing', async () => {
			await privileges.categories.rescind(['groups:read'], cid, 'guests');
			const [test1, test2] = await Promise.all([
				request.get(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}`, { }),
				request.get(`${nconf.get('url')}/category/${cid}.rss?token=sometoken`, { }),
			]);

			assert.equal(test1.response.statusCode, 200);
			assert.equal(test2.response.statusCode, 200);
			assert(test1.body.includes('Login to your account'));
			assert(test2.body.includes('Login to your account'));
		});

		it('should not allow access if token is wrong', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=sometoken`);
			assert.equal(response.statusCode, 200);
			assert(body.includes('Login to your account'));
		});

		it('should allow access if token is correct', async () => {
			const { body: body1 } = await request.get(`${nconf.get('url')}/api/category/${cid}`, { jar });
			rssToken = body1.rssFeedUrl.split('token')[1].slice(1);
			const { response, body: body2 } = await request.get(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=${rssToken}`);
			assert.equal(response.statusCode, 200);
			assert(body2.startsWith('<?xml version="1.0"'));
		});

		it('should not allow access if token is correct but has no privilege', async () => {
			await privileges.categories.rescind(['groups:read'], cid, 'registered-users');
			const { response, body } = await request.get(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=${rssToken}`);
			assert.equal(response.statusCode, 200);
			assert(body.includes('Login to your account'));
		});
	});
});
