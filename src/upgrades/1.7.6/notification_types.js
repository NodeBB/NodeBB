'use strict';

var async = require('async');
var db = require('../../database');

module.exports = {
	name: 'Add default settings for notification delivery types',
	timestamp: Date.UTC(2018, 1, 14),
	method: function (callback) {
		async.waterfall([
			function (next) {
				db.getObject('config', next);
			},
			function (config, next) {
				db.setObject('config', {
					notificationType_upvote: config.notificationType_upvote || 'notification',
					'notificationType_new-topic': config.notificationType_upvote || 'notification',
					'notificationType_new-reply': config.notificationType_upvote || 'notification',
					notificationType_follow: config.notificationType_upvote || 'notification',
					'notificationType_new-chat': config.notificationType_upvote || 'notification',
					'notificationType_group-invite': config.notificationType_upvote || 'notification',
				}, next);
			},
		], callback);
	},
};
