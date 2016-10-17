'use strict';
/*global require, before, after*/

var	assert = require('assert');
var async = require('async');
var request = require('request');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var topics = require('../src/topics');
var categories = require('../src/categories');
var user = require('../src/user');
var search = require('../src/search');

describe('Search', function () {
	var phoebeUid;
	var gingerUid;

	var topic1Data;
	var topic2Data;
	var post1Data;
	var post2Data;
	var post3Data;
	var cid1;
	var cid2;

	before(function (done) {
		async.waterfall([
			function (next) {
				async.series({
					phoebe: function (next) {
						user.create({username: 'phoebe'}, next);
					},
					ginger: function (next) {
						user.create({username: 'ginger'}, next);
					},
					category1: function (next) {
						categories.create({
							name: 'Test Category',
							description: 'Test category created by testing script'
						}, next);
					},
					category2: function (next) {
						categories.create({
							name: 'Test Category',
							description: 'Test category created by testing script'
						}, next);
					}
				}, next);
			},
			function (results, next) {
				phoebeUid = results.phoebe;
				gingerUid = results.ginger;
				cid1 = results.category1.cid;
				cid2 = results.category2.cid;

				async.waterfall([
					function (next) {
						topics.post({
							uid: phoebeUid,
							cid: cid1,
							title: 'nodebb mongodb bugs',
							content: 'avocado cucumber apple orange fox',
							tags: ['nodebb', 'bug', 'plugin', 'nodebb-plugin']
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
							tags: ['nodebb', 'bug', 'plugin', 'nodebb-plugin']
						}, next);
					},
					function (results, next) {
						topic2Data = results.topicData;
						post2Data = results.postData;
						topics.reply({
							uid: phoebeUid,
							content: 'reply post apple',
							tid: topic2Data.tid
						}, next);
					},
					function (_post3Data, next) {
						post3Data = _post3Data;
						setTimeout(next, 500);
					}
				], next);
			}
		], done);
	});

	it('should search term in titles and posts', function (done) {

		var meta = require('../src/meta');
		meta.config.allowGuestSearching = 1;

		request({
			url: nconf.get('url') + '/api/search?term=cucumber&in=titlesposts&by=phoebe&replies=1&repliesFilter=atleast&sortBy=timestamp&sortDirection=desc&showAs=posts',
			json: true
		}, function (err, response, body) {
			assert.ifError(err);
			assert(body);
			assert.equal(body.matchCount, 1);
			assert.equal(body.posts.length, 1);
			assert.equal(body.posts[0].pid, post1Data.pid);
			assert.equal(body.posts[0].uid, phoebeUid);

			done();
		});
	});

	it('should search for a user', function (done) {
		search.search({
			query: 'gin',
			searchIn: 'users'
		}, function (err, data) {
			assert.ifError(err);
			assert(data);
			assert.equal(data.matchCount, 1);
			assert.equal(data.users.length, 1);
			assert.equal(data.users[0].uid, gingerUid);
			assert.equal(data.users[0].username, 'ginger');
			done();
		});
	});

	it('should search for a tag', function (done) {
		search.search({
			query: 'plug',
			searchIn: 'tags'
		}, function (err, data) {
			assert.ifError(err);
			assert(data);
			assert.equal(data.matchCount, 1);
			assert.equal(data.tags.length, 1);
			assert.equal(data.tags[0].value, 'plugin');
			assert.equal(data.tags[0].score, 2);
			done();
		});
	});

	it('should fail if searchIn is wrong', function (done) {
		search.search({
			query: 'plug',
			searchIn: 'invalidfilter'
		}, function (err) {
			assert.equal(err.message, '[[error:unknown-search-filter]]');
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
