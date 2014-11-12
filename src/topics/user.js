

'use strict';

var db = require('../database');


module.exports = function(Topics) {

	Topics.isOwner = function(tid, uid, callback) {
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Topics.getTopicField(tid, 'uid', function(err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	Topics.getUids = function(tid, callback) {
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['uid'], function(err, data) {
				if (err) {
					return callback(err);
				}

				var uids = data.map(function(data) {
					return data.uid;
				}).filter(function(uid, pos, array) {
					return array.indexOf(uid) === pos;
				});

				callback(null, uids);
			});
		});
	};
};