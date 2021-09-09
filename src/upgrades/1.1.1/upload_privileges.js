'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Giving upload privileges',
	timestamp: Date.UTC(2016, 6, 12),
	method: function (callback) {
		var privilegesAPI = require('../../privileges');
		var meta = require('../../meta');

		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, function (cid, next) {
				privilegesAPI.categories.list(cid, function (err, data) {
					if (err) {
						return next(err);
					}
					async.eachSeries(data.groups, function (group, next) {
						if (group.name === 'guests' && parseInt(meta.config.allowGuestUploads, 10) !== 1) {
							return next();
						}
						if (group.privileges['groups:read']) {
							privilegesAPI.categories.give(['upload:post:image'], cid, group.name, next);
						} else {
							next();
						}
					}, next);
				});
			}, callback);
		});
	},
};
