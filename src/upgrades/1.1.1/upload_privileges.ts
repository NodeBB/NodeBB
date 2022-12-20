'use strict';

import async from 'async';
import db from '../../database';


import privilegesAPI from '../../privileges';
import meta from '../../meta';


export const obj = {
	name: 'Giving upload privileges',
	timestamp: Date.UTC(2016, 6, 12),
	method: function (callback) {

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
