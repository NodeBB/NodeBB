'use strict';

const async = require('async');
const db = require('../../database');


module.exports = {
	name: 'Favourites to Bookmarks',
	timestamp: Date.UTC(2016, 9, 8),
	method: function (callback) {
		const progress = this.progress;

		function upgradePosts(next) {
			const batch = require('../../batch');

			batch.processSortedSet('posts:pid', (ids, next) => {
				async.each(ids, (id, next) => {
					progress.incr();

					async.waterfall([
						function (next) {
							db.rename(`pid:${id}:users_favourited`, `pid:${id}:users_bookmarked`, next);
						},
						function (next) {
							db.getObjectField(`post:${id}`, 'reputation', next);
						},
						function (reputation, next) {
							if (parseInt(reputation, 10)) {
								db.setObjectField(`post:${id}`, 'bookmarks', reputation, next);
							} else {
								next();
							}
						},
						function (next) {
							db.deleteObjectField(`post:${id}`, 'reputation', next);
						},
					], next);
				}, next);
			}, {
				progress: progress,
			}, next);
		}

		function upgradeUsers(next) {
			const batch = require('../../batch');

			batch.processSortedSet('users:joindate', (ids, next) => {
				async.each(ids, (id, next) => {
					db.rename(`uid:${id}:favourites`, `uid:${id}:bookmarks`, next);
				}, next);
			}, {}, next);
		}

		async.series([upgradePosts, upgradeUsers], callback);
	},
};
