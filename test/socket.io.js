'use strict';

// see https://gist.github.com/jfromaniello/4087861#gistcomment-1447029

/* global process, require, before, after*/

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var assert = require('assert');
var async = require('async');
var nconf = require('nconf');
var request = require('request');
var cookies = request.jar();

var db = require('./mocks/databasemock');
var myXhr = require('./mocks/newXhr');
var user = require('../src/user');
var groups = require('../src/groups');
var categories = require('../src/categories');

describe('socket.io', function () {

	var io;
	var cid;
	var tid;
	var adminUid;

	before(function (done) {
		async.series([
			async.apply(user.create, { username: 'admin', password: 'adminpwd' }),
			async.apply(user.create, { username: 'regular', password: 'regularpwd' }),
			async.apply(categories.create, {
				name: 'Test Category',
				description: 'Test category created by testing script'
			})
		], function (err, data) {
			if (err) {
				return done(err);
			}
			adminUid = data[0];
			cid = data[2].cid;

			groups.join('administrators', data[0], done);
		});
	});


	it('should connect and auth properly', function (done) {
		request.get({
			url: nconf.get('url') + '/api/config',
			jar: cookies,
			json: true
		}, function (err, res, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				jar: cookies,
				form: {
					username: 'admin',
					password: 'adminpwd'
				},
				headers: {
					'x-csrf-token': body.csrf_token
				},
				json: true
			}, function (err, res, body) {
				assert.ifError(err);

				myXhr.callbacks.test2 = function () {
					this.setDisableHeaderCheck(true);
					var stdOpen = this.open;
					this.open = function () {
						stdOpen.apply(this, arguments);
						this.setRequestHeader('Cookie', res.headers['set-cookie'][0].split(';')[0]);
					};
				};

				io = require('socket.io-client')(nconf.get('url'), {forceNew: true});

				io.on('connect', function () {
					done();
				});

				io.on('error', function (err) {
					done(err);
				});
			});
		});
	});

	it('should return error for unknown event', function (done) {
		io.emit('unknown.event', function (err) {
			assert(err);
			assert.equal(err.message, '[[error:invalid-event]]');
			done();
		});
	});

	it('should get installed themes', function (done) {
		var themes = ['nodebb-theme-lavender', 'nodebb-theme-persona', 'nodebb-theme-vanilla'];
		io.emit('admin.themes.getInstalled', function (err, data) {
			assert.ifError(err);
			assert(data);
			var installed = data.map(function (theme) {
				return theme.id;
			});
			themes.forEach(function (theme) {
				assert.notEqual(installed.indexOf(theme), -1);
			});
			done();
		});
	});

	it('should post a topic', function (done) {
		io.emit('topics.post', {title: 'test topic title', content: 'test topic main post content', uid: adminUid, cid: cid}, function (err, result) {
			assert.ifError(err);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.category.cid, cid);
			assert.equal(result.mainPost.content, 'test topic main post content');
			tid = result.tid;
			done();
		});
	});

	it('should reply to topic', function (done) {
		io.emit('posts.reply', {tid: tid, uid: adminUid, content: 'test post content'}, function (err, result) {
			assert.ifError(err);
			assert.equal(result.uid, adminUid);
			assert.equal(result.user.username, 'admin');
			assert.equal(result.topic.tid, tid);
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});

});

