'use strict';

const async = require('async');
const db = require('../../database');


module.exports = {
	name: 'Giving upload privileges',
	timestamp: Date.UTC(2016, 6, 12),
	method: function (callback) {
		const privilegesAPI = require('../../privileges');
		const meta = require('../../meta');

		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, (cid, next) => {
				privilegesAPI.categories.list(cid, (err, data) => {
					if (err) {
						return next(err);
					}
					async.eachSeries(data.groups, (group, next) => {
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
