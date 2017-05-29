'use strict';

/* global require, after, before*/

var assert = require('assert');
var path = require('path');
var fs = require('fs');

var db = require('./mocks/databasemock');
var logger = require('../src/logger');
var index = require('../src/socket.io');
var meta = require('../src/meta');
var user = require('../src/user');
var helpers = require('./helpers');

describe('logger', function () {
	var jar;
	var io;
	before(function (done) {
		user.create({ username: 'loggeruser', password: '123456' }, function (err) {
			assert.ifError(err);
			helpers.loginUser('loggeruser', '123456', function (err, _jar, _io) {
				assert.ifError(err);
				jar = _jar;
				io = _io;
				done();
			});
		});
	});

	it('should enable logging', function (done) {
		meta.config.loggerStatus = 1;
		meta.config.loggerIOStatus = 1;
		var loggerPath = path.join(__dirname, '..', 'logs', 'logger.log');
		logger.monitorConfig({ io: index.server }, { key: 'loggerPath', value: loggerPath });
		setTimeout(function () {
			io.emit('meta.rooms.enter', { enter: 'recent_topics' }, function (err) {
				assert.ifError(err);
				fs.readFile(loggerPath, 'utf-8', function (err, content) {
					assert.ifError(err);
					assert(content);
					done();
				});
			});
		}, 500);
	});

	after(function (done) {
		meta.config.loggerStatus = 0;
		meta.config.loggerIOStatus = 0;
		done();
	});
});
