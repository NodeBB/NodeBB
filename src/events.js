

var fs = require('fs'),
	path = require('path'),
	nconf = require('nconf'),
	user = require('./user');


(function(events) {
	var logFileName = 'events.log';

	events.logPasswordChange = function(uid) {
		log(uid, 'changed password');
	}

	events.logPasswordReset = function(uid) {
		log(uid, 'reset password');
	}

	events.logEmailChange = function(uid, oldEmail, newEmail) {
		log(uid,'changed email from "' + oldEmail + '" to "' + newEmail +'"');
	}

	events.logUsernameChange = function(uid, oldUsername, newUsername) {
		log(uid,'changed username from "' + oldUsername + '" to "' + newUsername +'"');
	}

	events.logAdminLogin = function(uid) {
		log(uid, 'logged into admin panel');
	}

	events.logPostEdit = function(uid, pid) {
		log(uid, 'edited post (pid ' + pid + ')');
	}

	events.logPostDelete = function(uid, pid) {
		log(uid, 'deleted post (pid ' + pid + ')');
	}

	events.logPostRestore = function(uid, pid) {
		log(uid, 'restored post (pid ' + pid + ')');
	}

	events.logTopicDelete = function(uid, tid) {
		log(uid, 'deleted topic (tid ' + tid + ')');
	}

	events.logTopicRestore = function(uid, tid) {
		log(uid, 'restored topic (tid ' + tid + ')');
	}

	function log(uid, string) {

		user.getUserField(uid, 'username', function(err, username) {
			if(err) {
				winston.error('Error logging event. ' + err.message);
				return;
			}

			var date = new Date().toUTCString();

			var msg = '[' + date + '] - ' + username + '(uid ' + uid + ') ' + string + '\n';
			var logFile = path.join(nconf.get('base_dir'), logFileName);

			fs.appendFile(logFile, msg, function(err) {
				if(err) {
					winston.error('Error logging event. ' + err.message);
					return;
				}
			});
		});
	}

	events.getLog = function(callback) {
		var logFile = path.join(nconf.get('base_dir'), logFileName);

		fs.readFile(logFile, callback);
	}

}(module.exports));