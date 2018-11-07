'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Removing best posts with negative scores',
	timestamp: Date.UTC(2016, 7, 5),
	method: function (callback) {
		var batch = require('../../batch');
		batch.processSortedSet('users:joindate', function (ids, next) {
			async.each(ids, function (id, next) {
				winston.verbose('processing uid ' + id);
				db.sortedSetsRemoveRangeByScore(['uid:' + id + ':posts:votes'], '-inf', 0, next);
			}, next);
		}, {}, callback);
	},
};
