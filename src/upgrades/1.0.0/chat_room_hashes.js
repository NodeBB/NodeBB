'use strict';

const async = require('async');
const db = require('../../database');


module.exports = {
	name: 'Chat room hashes',
	timestamp: Date.UTC(2015, 11, 23),
	method: function (callback) {
		db.getObjectField('global', 'nextChatRoomId', (err, nextChatRoomId) => {
			if (err) {
				return callback(err);
			}
			let currentChatRoomId = 1;
			async.whilst((next) => {
				next(null, currentChatRoomId <= nextChatRoomId);
			}, (next) => {
				db.getSortedSetRange(`chat:room:${currentChatRoomId}:uids`, 0, 0, (err, uids) => {
					if (err) {
						return next(err);
					}
					if (!Array.isArray(uids) || !uids.length || !uids[0]) {
						currentChatRoomId += 1;
						return next();
					}

					db.setObject(`chat:room:${currentChatRoomId}`, { owner: uids[0], roomId: currentChatRoomId }, (err) => {
						if (err) {
							return next(err);
						}
						currentChatRoomId += 1;
						next();
					});
				});
			}, callback);
		});
	},
};
