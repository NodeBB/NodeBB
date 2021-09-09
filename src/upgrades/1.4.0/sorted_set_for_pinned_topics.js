'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Sorted set for pinned topics',
	timestamp: Date.UTC(2016, 10, 25),
	method: function (callback) {
		var topics = require('../../topics');
		var batch = require('../../batch');
		batch.processSortedSet('topics:tid', function (ids, next) {
			topics.getTopicsFields(ids, ['tid', 'cid', 'pinned', 'lastposttime'], function (err, data) {
				if (err) {
					return next(err);
				}

				data = data.filter(function (topicData) {
					return parseInt(topicData.pinned, 10) === 1;
				});

				async.eachSeries(data, function (topicData, next) {
					winston.verbose('processing tid: ' + topicData.tid);

					async.parallel([
						async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:pinned', Date.now(), topicData.tid),
						async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids', topicData.tid),
						async.apply(db.sortedSetRemove, 'cid:' + topicData.cid + ':tids:posts', topicData.tid),
					], next);
				}, next);
			});
		}, callback);
	},
};
