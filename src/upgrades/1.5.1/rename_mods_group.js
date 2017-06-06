'use strict';

var async = require('async');
var winston = require('winston');

var batch = require('../../batch');
var groups = require('../../groups');


module.exports = {
	name: 'rename user mod privileges group',
	timestamp: Date.UTC(2017, 4, 26),
	method: function (callback) {
		var progress = this.progress;
		batch.processSortedSet('categories:cid', function (cids, next) {
			async.eachSeries(cids, function (cid, next) {
				var groupName = 'cid:' + cid + ':privileges:mods';
				var newName = 'cid:' + cid + ':privileges:moderate';
				groups.exists(groupName, function (err, exists) {
					if (err || !exists) {
						progress.incr();
						return next(err);
					}
					winston.verbose('renaming ' + groupName + ' to ' + newName);
					progress.incr();
					groups.renameGroup(groupName, newName, next);
				});
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
