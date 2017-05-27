'use strict';

/* global require, after, before*/


var async = require('async');
var assert = require('assert');
var path = require('path');

var db = require('./mocks/databasemock');
var logger = require('../src/logger');
var index = require('../src/socket.io');
var meta = require('../src/meta');

describe('logger', function () {
	before(function (done) {
		done();
	});

	it('should enable logging', function (done) {
		meta.config.loggerStatus = 1;
		meta.config.loggerIOStatus = 1;
		var loggerPath = path.join(__dirname, '..', 'logs', 'logger.log');
		logger.monitorConfig({ io: index.server }, { loggerPath: loggerPath });
		setTimeout(function () {
			meta.config.loggerStatus = 0;
			meta.config.loggerIOStatus = 0;
			done();
		}, 500);
	});
});
