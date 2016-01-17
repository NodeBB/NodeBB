'use strict';

var async = require('async');
var db = require('../database');

module.exports = function(Messaging) {

	Messaging.deleteMessage = function(mid, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.getUidsInRoom(roomId, 0, -1, next);
			},
			function (uids, next) {
				if (!uids.length) {
					return next();
				}
				var keys = uids.map(function(uid) {
					return 'uid:' + uid + ':chat:room:' + roomId + 'mids';
				});
				db.sortedSetsRemove(keys, roomId, next);
			},
			function(next) {
				db.delete('message:' + mid, next);
			}
		], callback);
	};
};