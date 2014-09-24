
'use strict';

var fs = require('fs'),
	winston = require('winston'),
	path = require('path'),
	nconf = require('nconf'),
	user = require('./user');


(function(events) {
	var logFileName = 'logs/events.log';

	events.logPasswordChange = function(uid) {
		events.logWithUser(uid, 'changed password');
	};

	events.logAdminChangeUserPassword = function(adminUid, theirUid, callback) {
		logAdminEvent(adminUid, theirUid, 'changed password of', callback);
	};

	events.logAdminUserDelete = function(adminUid, theirUid, callback) {
		logAdminEvent(adminUid, theirUid, 'deleted', callback);
	};

	function logAdminEvent(adminUid, theirUid, message, callback) {
		user.getMultipleUserFields([adminUid, theirUid], ['username'], function(err, userData) {
			if(err) {
				return winston.error('Error logging event. ' + err.message);
			}

			var msg = userData[0].username + '(uid ' + adminUid + ') ' + message + ' ' +  userData[1].username + '(uid ' + theirUid + ')';
			events.log(msg, callback);
		});
	}

	events.logPasswordReset = function(uid) {
		events.logWithUser(uid, 'reset password');
	};

	events.logEmailChange = function(uid, oldEmail, newEmail) {
		events.logWithUser(uid,'changed email from "' + oldEmail + '" to "' + newEmail +'"');
	};

	events.logUsernameChange = function(uid, oldUsername, newUsername) {
		events.logWithUser(uid,'changed username from "' + oldUsername + '" to "' + newUsername +'"');
	};

	events.logAdminLogin = function(uid) {
		events.logWithUser(uid, 'logged into admin panel');
	};

	events.logPostEdit = function(uid, pid) {
		events.logWithUser(uid, 'edited post (pid ' + pid + ')');
	};

	events.logPostDelete = function(uid, pid) {
		events.logWithUser(uid, 'deleted post (pid ' + pid + ')');
	};

	events.logPostRestore = function(uid, pid) {
		events.logWithUser(uid, 'restored post (pid ' + pid + ')');
	};

	events.logTopicDelete = function(uid, tid) {
		events.logWithUser(uid, 'deleted topic (tid ' + tid + ')');
	};

	events.logTopicRestore = function(uid, tid) {
		events.logWithUser(uid, 'restored topic (tid ' + tid + ')');
	};

	events.logWithUser = function(uid, string) {
		user.getUserField(uid, 'username', function(err, username) {
			if(err) {
				return winston.error('Error logging event. ' + err.message);
			}

			var msg = username + '(uid ' + uid + ') ' + string;
			events.log(msg);
		});
	}

	events.log = function(msg, callback) {
		var logFile = path.join(nconf.get('base_dir'), logFileName);

		msg = '[' + new Date().toUTCString() + '] - ' + msg;

		fs.appendFile(logFile, msg + '\n', function(err) {
			if(err) {
				winston.error('Error logging event. ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			if (typeof callback === 'function') {
				callback();
			}
		});
	};

	events.getLog = function(callback) {
		var logFile = path.join(nconf.get('base_dir'), logFileName);

		fs.readFile(logFile, function(err, res) {
			if(err) {
				return callback(null, 'No logs found!');
			}
			callback(null, res);
		});
	};

}(module.exports));
