'use strict';
/*global require, before*/

var	assert = require('assert');
var nconf = require('nconf');
var request = require('request');

var db = require('./mocks/databasemock');
var user = require('../src/user');

describe('authentication', function () {
	var jar = request.jar();

	before(function (done) {
		user.create({username: 'regular', password: 'regularpwd', email: 'regular@nodebb.org' }, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should register and login a user', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/register', {
				form: {
					email: 'admin@nodebb.org',
					username: 'admin',
					password: 'adminpwd',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token
				}
			}, function (err, response, body) {
				assert.ifError(err);
				assert(body);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar
				}, function (err, response, body) {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'admin');
					assert.equal(body.email, 'admin@nodebb.org');
					done();
				});
			});
		});
	});

	it('should logout a user', function (done) {
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/logout', {
				form: {},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token
				}
			}, function (err, response, body) {
				assert.ifError(err);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar
				}, function (err, response, body) {
					assert.ifError(err);
					assert.equal(body, 'not-authorized');
					done()
				});
			});
		});
	});

	it('should login a user', function (done) {
		var jar = request.jar();
		request({
			url: nconf.get('url') + '/api/config',
			json: true,
			jar: jar
		}, function (err, response, body) {
			assert.ifError(err);

			request.post(nconf.get('url') + '/login', {
				form: {
					username: 'regular',
					password: 'regularpwd',
				},
				json: true,
				jar: jar,
				headers: {
					'x-csrf-token': body.csrf_token
				}
			}, function (err, response, body) {
				assert.ifError(err);
				assert(body);

				request({
					url: nconf.get('url') + '/api/me',
					json: true,
					jar: jar
				}, function (err, response, body) {
					assert.ifError(err);
					assert(body);
					assert.equal(body.username, 'regular');
					assert.equal(body.email, 'regular@nodebb.org');
					done()
				});
			});
		});
	});


	after(function (done) {
		db.emptydb(done);
	});

});

