'use strict';

const assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const categories = require('../src/categories');
const groups = require('../src/groups');
const user = require('../src/user');
const meta = require('../src/meta');
const privileges = require('../src/privileges');
const helpers = require('./helpers');

describe('feeds', () => {
	let tid;
	let pid;
	let fooUid;
	let cid;
	before((done) => {
		meta.config['feeds:disableRSS'] = 1;
		async.series({
			category: function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			user: function (next) {
				user.create({ username: 'foo', password: 'barbar', email: 'foo@test.com' }, next);
			},
		}, (err, results) => {
			if (err) {
				return done(err);
			}
			cid = results.category.cid;
			fooUid = results.user;

			topics.post({ uid: results.user, title: 'test topic title', content: 'test topic content', cid: results.category.cid }, (err, result) => {
				tid = result.topicData.tid;
				pid = result.postData.pid;
				done(err);
			});
		});
	});


	it('should 404', (done) => {
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
		async.eachSeries(feedUrls, (url, next) => {
			request(url, (err, res) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 404);
				next();
			});
		}, (err) => {
			assert.ifError(err);
			meta.config['feeds:disableRSS'] = 0;
			done();
		});
	});

	it('should 404 if topic does not exist', (done) => {
		request(`${nconf.get('url')}/topic/${1000}.rss`, (err, res) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should 404 if category id is not a number', (done) => {
		request(`${nconf.get('url')}/category/invalid.rss`, (err, res) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should redirect if we do not have read privilege', (done) => {
		privileges.categories.rescind(['groups:topics:read'], cid, 'guests', (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/topic/${tid}.rss`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.includes('Login to your account'));
				privileges.categories.give(['groups:topics:read'], cid, 'guests', done);
			});
		});
	});

	it('should 404 if user is not found', (done) => {
		request(`${nconf.get('url')}/user/doesnotexist/topics.rss`, (err, res) => {
			assert.ifError(err);
			assert.equal(res.statusCode, 404);
			done();
		});
	});

	it('should redirect if we do not have read privilege', (done) => {
		privileges.categories.rescind(['groups:read'], cid, 'guests', (err) => {
			assert.ifError(err);
			request(`${nconf.get('url')}/category/${cid}.rss`, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				assert(body.includes('Login to your account'));
				privileges.categories.give(['groups:read'], cid, 'guests', done);
			});
		});
	});

	describe('private feeds and tokens', () => {
		let jar;
		let rssToken;
		before((done) => {
			helpers.loginUser('foo', 'barbar', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should load feed if its not private', (done) => {
			request(`${nconf.get('url')}/category/${cid}.rss`, { }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body);
				done();
			});
		});


		it('should not allow access if uid or token is missing', (done) => {
			privileges.categories.rescind(['groups:read'], cid, 'guests', (err) => {
				assert.ifError(err);
				async.parallel({
					test1: function (next) {
						request(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}`, { }, next);
					},
					test2: function (next) {
						request(`${nconf.get('url')}/category/${cid}.rss?token=sometoken`, { }, next);
					},
				}, (err, results) => {
					assert.ifError(err);
					assert.equal(results.test1[0].statusCode, 200);
					assert.equal(results.test2[0].statusCode, 200);
					assert(results.test1[0].body.includes('Login to your account'));
					assert(results.test2[0].body.includes('Login to your account'));
					done();
				});
			});
		});

		it('should not allow access if token is wrong', (done) => {
			request(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=sometoken`, { }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert(body.includes('Login to your account'));
				done();
			});
		});

		it('should allow access if token is correct', (done) => {
			request(`${nconf.get('url')}/api/category/${cid}`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				rssToken = body.rssFeedUrl.split('token')[1].slice(1);
				request(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=${rssToken}`, { }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.startsWith('<?xml version="1.0"'));
					done();
				});
			});
		});

		it('should not allow access if token is correct but has no privilege', (done) => {
			privileges.categories.rescind(['groups:read'], cid, 'registered-users', (err) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/category/${cid}.rss?uid=${fooUid}&token=${rssToken}`, { }, (err, res, body) => {
					assert.ifError(err);
					assert.equal(res.statusCode, 200);
					assert(body.includes('Login to your account'));
					done();
				});
			});
		});
	});
});
