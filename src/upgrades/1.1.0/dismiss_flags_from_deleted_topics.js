/* jslint node: true */

'use strict';

var db = require('../database');

var async = require('async');
var winston = require('winston');

module.exports = {
	name: 'Dismiss flags from deleted topics',
	timestamp: Date.UTC(2016, 3, 29),
	method: function (callback) {
		var posts = require('../posts');
		var topics = require('../topics');

		var pids;
		var tids;

		async.waterfall([
			async.apply(db.getSortedSetRange, 'posts:flagged', 0, -1),
			function (_pids, next) {
				pids = _pids;
				posts.getPostsFields(pids, ['tid'], next);
			},
			function (_tids, next) {
				tids = _tids.map(function (a) {
					return a.tid;
				});

				topics.getTopicsFields(tids, ['deleted'], next);
			},
			function (state, next) {
				var toDismiss = state.map(function (a, idx) {
					return parseInt(a.deleted, 10) === 1 ? pids[idx] : null;
				}).filter(Boolean);

				winston.verbose('[2016/04/29] ' + toDismiss.length + ' dismissable flags found');
				async.each(toDismiss, posts.dismissFlag, next);
			},
		], callback);
	},
};
