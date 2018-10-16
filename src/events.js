
'use strict';

var async = require('async');
var validator = require('validator');
var winston = require('winston');
var _ = require('lodash');

var db = require('./database');
var batch = require('./batch');
var user = require('./user');
var utils = require('./utils');

var events = module.exports;

events.types = [
	'plugin-activate',
	'plugin-deactivate',
	'restart',
	'build',
	'config-change',
	'settings-change',
	'category-purge',
	'privilege-change',
	'post-delete',
	'post-restore',
	'post-purge',
	'topic-delete',
	'topic-restore',
	'topic-purge',
	'topic-rename',
	'password-reset',
	'user-ban',
	'user-unban',
	'user-delete',
	'password-change',
	'email-change',
	'username-change',
	'ip-blacklist-save',
	'ip-blacklist-addRule',
	'registration-approved',
	'registration-rejected',
	'accept-membership',
	'reject-membership',
	'theme-set',
	'export:uploads',
	'account-locked',
	'getUsersCSV',
];

/**
 * Useful options in data: type, uid, ip, targetUid
 * Everything else gets stringified and shown as pretty JSON string
 */
events.log = function (data, callback) {
	callback = callback || function () {};

	async.waterfall([
		function (next) {
			db.incrObjectField('global', 'nextEid', next);
		},
		function (eid, next) {
			data.timestamp = Date.now();
			data.eid = eid;

			async.parallel([
				function (next) {
					db.sortedSetAdd('events:time', data.timestamp, eid, next);
				},
				function (next) {
					db.sortedSetAdd('events:time:' + data.type, data.timestamp, eid, next);
				},
				function (next) {
					db.setObject('event:' + eid, data, next);
				},
			], next);
		},
	], function (err) {
		callback(err);
	});
};

events.getEvents = function (filter, start, stop, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange('events:time' + (filter ? ':' + filter : ''), start, stop, next);
		},
		function (eids, next) {
			var keys = eids.map(function (eid) {
				return 'event:' + eid;
			});
			db.getObjects(keys, next);
		},
		function (eventsData, next) {
			eventsData = eventsData.filter(Boolean);
			addUserData(eventsData, 'uid', 'user', next);
		},
		function (eventsData, next) {
			addUserData(eventsData, 'targetUid', 'targetUser', next);
		},
		function (eventsData, next) {
			eventsData.forEach(function (event) {
				Object.keys(event).forEach(function (key) {
					if (typeof event[key] === 'string') {
						event[key] = validator.escape(String(event[key] || ''));
					}
				});
				var e = utils.merge(event);
				e.eid = undefined;
				e.uid = undefined;
				e.type = undefined;
				e.ip = undefined;
				e.user = undefined;
				event.jsonString = JSON.stringify(e, null, 4);
				event.timestampISO = new Date(parseInt(event.timestamp, 10)).toUTCString();
			});
			next(null, eventsData);
		},
	], callback);
};

function addUserData(eventsData, field, objectName, callback) {
	var uids = eventsData.map(function (event) {
		return event && event[field];
	}).filter(function (uid, index, array) {
		return uid && array.indexOf(uid) === index;
	});

	if (!uids.length) {
		return callback(null, eventsData);
	}

	async.waterfall([
		function (next) {
			async.parallel({
				isAdmin: function (next) {
					user.isAdministrator(uids, next);
				},
				userData: function (next) {
					user.getUsersFields(uids, ['username', 'userslug', 'picture'], next);
				},
			}, next);
		},
		function (results, next) {
			var userData = results.userData;

			var map = {};
			userData.forEach(function (user, index) {
				user.isAdmin = results.isAdmin[index];
				map[user.uid] = user;
			});

			eventsData.forEach(function (event) {
				if (map[event[field]]) {
					event[objectName] = map[event[field]];
				}
			});
			next(null, eventsData);
		},
	], callback);
}

events.deleteEvents = function (eids, callback) {
	callback = callback || function () {};
	var keys;
	async.waterfall([
		function (next) {
			keys = eids.map(function (eid) {
				return 'event:' + eid;
			});
			db.getObjectsFields(keys, ['type'], next);
		},
		function (eventData, next) {
			var sets = _.uniq(['events:time'].concat(eventData.map(e => 'events:time:' + e.type)));
			async.parallel([
				function (next) {
					db.deleteAll(keys, next);
				},
				function (next) {
					db.sortedSetRemove(sets, eids, next);
				},
			], next);
		},
	], callback);
};

events.deleteAll = function (callback) {
	callback = callback || function () {};

	batch.processSortedSet('events:time', function (eids, next) {
		events.deleteEvents(eids, next);
	}, { alwaysStartAt: 0 }, callback);
};

events.output = function () {
	console.log('\nDisplaying last ten administrative events...'.bold);
	events.getEvents('', 0, 9, function (err, events) {
		if (err) {
			winston.error('Error fetching events', err);
			throw err;
		}

		events.forEach(function (event) {
			console.log('  * ' + String(event.timestampISO).green + ' ' + String(event.type).yellow + (event.text ? ' ' + event.text : '') + ' (uid: '.reset + (event.uid ? event.uid : 0) + ')');
		});

		process.exit(0);
	});
};
