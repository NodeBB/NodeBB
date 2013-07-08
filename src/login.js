
var user = require('./user.js'),
	bcrypt = require('bcrypt'),
	RDB = require('./redis.js');

(function(Login){

	Login.loginViaLocal = function(username, password, next) {

		if (!username || !password) {
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {
			RDB.get('username:' + username + ':uid', function(err, uid) {
				RDB.handle(err);

				if (uid == null) {
					return next({
						status: 'error',
						message: 'invalid-user'
					});
				}
				
				user.getUserField(uid, 'password', function(user_password) {
					bcrypt.compare(password, user_password, function(err, res) {
						if(err) {
							console.log(err);
							next({
								status: "error",
								message: 'bcrypt compare error'
							});
							return;
						}
						
						if (res) {
							next({
								status: "ok",
								user: {
									uid: uid
								}
							});
						} else {
							next({
								status: 'error',
								message: 'invalid-password'
							});
						}
					});
				});
			});
		}
	}

	Login.loginViaTwitter = function(twid, handle, callback) {
		user.get_uid_by_twitter_id(twid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				user.create(handle, null, null, function(err, uid) {
					if (err !== null) {
						callback(err);
					} else {
						// Save twitter-specific information to the user
						user.setUserField(uid, 'twid', twid);
						RDB.hset('twid:uid', twid, uid);
						callback(null, {
							uid: uid
						});
					}
				});
			}
		});
	}

	Login.loginViaGoogle = function(gplusid, handle, email, callback) {
		user.get_uid_by_google_id(gplusid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function(uid) {
					// Save google-specific information to the user
					user.setUserField(uid, 'gplusid', gplusid);
					RDB.hset('gplusid:uid', gplusid, uid);
					callback(null, {
						uid: uid
					});
				}

				user.get_uid_by_email(email, function(uid) {
					if (!uid) {
						user.create(handle, null, email, function(err, uid) {
							if (err !== null) {
								callback(err);
							} else success(uid);
						});
					} else success(uid); // Existing account -- merge
				});
			}
		});
	}

	Login.loginViaFacebook = function(fbid, name, email, callback) {
		user.get_uid_by_fbid(fbid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function(uid) {
					// Save facebook-specific information to the user
					user.setUserField(uid, 'fbid', fbid);
					RDB.hset('fbid:uid', fbid, uid);
					callback(null, {
						uid: uid
					});
				}

				user.get_uid_by_email(email, function(uid) {
					if (!uid) {
						user.create(name, null, email, function(err, uid) {
							if (err !== null) {
								callback(err);
							} else success(uid);
						});
					} else success(uid); // Existing account -- merge
				});
			}
		});
	}

	Login.logout = function(sessionID, callback) {
		user.get_uid_by_session(sessionID, function(uid) {
			if (uid) {
				RDB.del('sess:' + sessionID + ':uid');
				RDB.del('uid:' + uid + ':session');
				callback(true);
			} else callback(false);
		});
	}

}(exports));

