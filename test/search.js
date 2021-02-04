'use strict';


const	assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const categories = require('../src/categories');
const user = require('../src/user');
const search = require('../src/search');
const privileges = require('../src/privileges');

describe('Search', () => {
	let phoebeUid;
	let gingerUid;

	let topic1Data;
	let topic2Data;
	let post1Data;
	let post2Data;
	let post3Data;
	let cid1;
	let cid2;
	let cid3;

	before((done) => {
		async.waterfall([
			function (next) {
				async.series({
					phoebe: function (next) {
						user.create({ username: 'phoebe' }, next);
					},
					ginger: function (next) {
						user.create({ username: 'ginger' }, next);
					},
					category1: function (next) {
						categories.create({
							name: 'Test Category',
							description: 'Test category created by testing script',
						}, next);
					},
					category2: function (next) {
						categories.create({
							name: 'Test Category',
							description: 'Test category created by testing script',
						}, next);
					},
				}, next);
			},
			function (results, next) {
				phoebeUid = results.phoebe;
				gingerUid = results.ginger;
				cid1 = results.category1.cid;
				cid2 = results.category2.cid;

				async.waterfall([
					function (next) {
						categories.create({
							name: 'Child Test Category',
							description: 'Test category created by testing script',
							parentCid: cid2,
						}, next);
					},
					function (category, next) {
						cid3 = category.cid;
						topics.post({
							uid: phoebeUid,
							cid: cid1,
							title: 'nodebb mongodb bugs',
							content: 'avocado cucumber apple orange fox',
							tags: ['nodebb', 'bug', 'plugin', 'nodebb-plugin', 'jquery'],
						}, next);
					},
					function (results, next) {
						topic1Data = results.topicData;
						post1Data = results.postData;

						topics.post({
							uid: gingerUid,
							cid: cid2,
							title: 'java mongodb redis',
							content: 'avocado cucumber carrot armadillo',
							tags: ['nodebb', 'bug', 'plugin', 'nodebb-plugin', 'javascript'],
						}, next);
					},
					function (results, next) {
						topic2Data = results.topicData;
						post2Data = results.postData;
						topics.reply({
							uid: phoebeUid,
							content: 'reply post apple',
							tid: topic2Data.tid,
						}, next);
					},
					function (_post3Data, next) {
						post3Data = _post3Data;
						setTimeout(next, 500);
					},
				], next);
			},
		], done);
	});

	it('should search term in titles and posts', (done) => {
		const meta = require('../src/meta');
		const qs = `/api/search?term=cucumber&in=titlesposts&categories[]=${cid1}&by=phoebe&replies=1&repliesFilter=atleast&sortBy=timestamp&sortDirection=desc&showAs=posts`;
		privileges.global.give(['groups:search:content'], 'guests', (err) => {
			assert.ifError(err);
			request({
				url: nconf.get('url') + qs,
				json: true,
			}, (err, response, body) => {
				assert.ifError(err);
				assert(body);
				assert.equal(body.matchCount, 1);
				assert.equal(body.posts.length, 1);
				assert.equal(body.posts[0].pid, post1Data.pid);
				assert.equal(body.posts[0].uid, phoebeUid);

				privileges.global.rescind(['groups:search:content'], 'guests', done);
			});
		});
	});

	it('should search for a user', (done) => {
		search.search({
			query: 'gin',
			searchIn: 'users',
		}, (err, data) => {
			assert.ifError(err);
			assert(data);
			assert.equal(data.matchCount, 1);
			assert.equal(data.users.length, 1);
			assert.equal(data.users[0].uid, gingerUid);
			assert.equal(data.users[0].username, 'ginger');
			done();
		});
	});

	it('should search for a tag', (done) => {
		search.search({
			query: 'plug',
			searchIn: 'tags',
		}, (err, data) => {
			assert.ifError(err);
			assert(data);
			assert.equal(data.matchCount, 1);
			assert.equal(data.tags.length, 1);
			assert.equal(data.tags[0].value, 'plugin');
			assert.equal(data.tags[0].score, 2);
			done();
		});
	});

	it('should fail if searchIn is wrong', (done) => {
		search.search({
			query: 'plug',
			searchIn: 'invalidfilter',
		}, (err) => {
			assert.equal(err.message, '[[error:unknown-search-filter]]');
			done();
		});
	});

	it('should search with tags filter', (done) => {
		search.search({
			query: 'mongodb',
			searchIn: 'titles',
			hasTags: ['nodebb', 'javascript'],
		}, (err, data) => {
			assert.ifError(err);
			assert.equal(data.posts[0].tid, topic2Data.tid);
			done();
		});
	});

	it('should not crash if tags is not an array', (done) => {
		search.search({
			query: 'mongodb',
			searchIn: 'titles',
			hasTags: 'nodebb,javascript',
		}, (err, data) => {
			assert.ifError(err);
			done();
		});
	});

	it('should not find anything', (done) => {
		search.search({
			query: 'xxxxxxxxxxxxxx',
		}, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data.posts));
			assert(!data.matchCount);
			done();
		});
	});

	it('should search child categories', (done) => {
		async.waterfall([
			function (next) {
				topics.post({
					uid: gingerUid,
					cid: cid3,
					title: 'child category topic',
					content: 'avocado cucumber carrot armadillo',
				}, next);
			},
			function (result, next) {
				search.search({
					query: 'avocado',
					searchIn: 'titlesposts',
					categories: [cid2],
					searchChildren: true,
					sortBy: 'topic.timestamp',
					sortDirection: 'desc',
				}, next);
			},
			function (result, next) {
				assert(result.posts.length, 2);
				assert(result.posts[0].topic.title === 'child category topic');
				assert(result.posts[1].topic.title === 'java mongodb redis');
				next();
			},
		], done);
	});

	it('should return json search data with no categories', (done) => {
		const qs = '/api/search?term=cucumber&in=titlesposts&searchOnly=1';
		privileges.global.give(['groups:search:content'], 'guests', (err) => {
			assert.ifError(err);
			request({
				url: nconf.get('url') + qs,
				json: true,
			}, (err, response, body) => {
				assert.ifError(err);
				assert(body);
				assert(body.hasOwnProperty('matchCount'));
				assert(body.hasOwnProperty('pagination'));
				assert(body.hasOwnProperty('pageCount'));
				assert(body.hasOwnProperty('posts'));
				assert(!body.hasOwnProperty('categories'));

				privileges.global.rescind(['groups:search:content'], 'guests', done);
			});
		});
	});
});
