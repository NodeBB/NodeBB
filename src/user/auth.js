var db = require('../database'),
	meta = require('../meta');

module.exports = function(User) {
	User.auth = {};

	User.auth.logAttempt = function(uid, callback) {
		db.exists('lockout:' + uid, function(err, exists) {
			if (!exists) {
				db.increment('loginAttempts:' + uid, function(err, attempts) {
					if ((meta.config.loginAttempts || 5) < attempts) {
						// Lock out the account
						db.set('lockout:' + uid, '', function(err) {
							db.delete('loginAttempts:' + uid);
							db.pexpire('lockout:' + uid, 1000*60*(meta.config.lockoutDuration || 60));
							callback(new Error('account-locked'));
						});
					} else {
						db.pexpire('loginAttempts:' + uid, 1000*60*60);
						callback();
					}
				});
			} else {
				callback(new Error('[[error:account-locked]]'));
			}
		})
	};

	User.auth.clearLoginAttempts = function(uid) {
		db.delete('loginAttempts:' + uid);
	};
};