'use strict';


const async = require('async');

const privileges = require('../../privileges');
const db = require('../../database');

module.exports = {
	name: 'Give post history viewing privilege to registered-users on all categories',
	timestamp: Date.UTC(2018, 5, 7),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}
			async.eachSeries(cids, (cid, next) => {
				privileges.categories.give(['groups:posts:history'], cid, 'registered-users', next);
			}, callback);
		});
	},
};
