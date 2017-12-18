'use strict';

var async = require('async');

module.exports = function (Messaging) {
	Messaging.deleteMessage = function (mid, roomId, callback) {
		async.waterfall([
			async.apply(Messaging.getMessageField, mid, 'deleted'),
			function (deleted, next) {
				if (parseInt(deleted, 10)) {
					return next(new Error('[[error:chat-deleted-already]]'));
				}

				Messaging.setMessageField(mid, 'deleted', 1, next);
			},
		], callback);
	};

	Messaging.restoreMessage = function (mid, roomId, callback) {
		async.waterfall([
			async.apply(Messaging.getMessageField, mid, 'deleted'),
			function (deleted, next) {
				if (!parseInt(deleted, 10)) {
					return next(new Error('[[error:chat-restored-already]]'));
				}

				Messaging.setMessageField(mid, 'deleted', 0, next);
			},
		], callback);
	};
};
