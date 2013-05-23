var	config = require('../config.js'),
	RDB = require('./redis.js');

(function(Notifications) {
	Notifications.get = function(nid, callback) {
		RDB.hmget('notifications:' + nid, 'text', 'score', 'path', function(err, notification) {
			callback({
				text: notification[0],
				score: notification[1],
				path: notification[2]
			});
		});
	}

	Notifications.create = function(text, score, path, callback) {
		/*
		 * Score guide:
		 * 0	Low priority messages (probably unused)
		 * 5	Normal messages
		 * 10	High priority messages
		 */
		RDB.incr('notifications:next_nid', function(err, nid) {
			RDB.hmset(
				'notifications:' + nid,
				'text', text || '',
				'score', score || 5,
				'path', path || null,
				'datetime', new Date().getTime(),
			function(err, status) {
				if (status === 'OK') callback(nid);
			});
		});
	}

	Notifications.push = function(nid, uids, callback) {
		if (!Array.isArray(uids)) uids = [uids];

		var	numUids = uids.length,
			x;

		Notifications.get(nid, function(notif_data) {
			for(x=0;x<numUids;x++) {
				if (parseInt(uids[x]) > 0) {
					RDB.zadd('uid:' + uids[x] + ':notifications:unread', notif_data.score, nid);
					if (callback) callback(true);
				}
			}
		});
	}

	Notifications.mark_read = function(nid, uid, callback) {
		if (parseInt(uid) > 0) {
			Notifications.get(nid, function(notif_data) {
				RDB.zrem('uid:' + uid + ':notifications:unread', nid);
				RDB.zadd('uid:' + uid + ':notifications:read', notif_data.score, nid);
				if (callback) callback(true);
			});
		}
	}
}(exports));