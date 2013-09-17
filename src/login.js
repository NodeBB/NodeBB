var user = require('./user.js'),
	bcrypt = require('bcrypt'),
	RDB = require('./redis.js'),
	path = require('path'),
	winston = require('winston');

(function(Login) {

	Login.loginViaLocal = function(username, password, next) {
		if (!username || !password) {
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {
			user.get_uid_by_username(username, function(err, uid) {
				if (err) {
					return next(new Error('redis-error'));
				}

				if (uid == null) {
					return next(new Error('invalid-user'));
				}

				user.getUserFields(uid, ['password', 'banned'], function(err, userData) {
					if (err) return next(err);

					if (userData.banned && userData.banned === '1') {
						return next({
							status: "error",
							message: "user-banned"
						});
					}

					bcrypt.compare(password, userData.password, function(err, res) {
						if (err) {
							winston.err(err.message);
							next(new Error('bcrypt compare error'));
							return;
						}

						if (res) {
							next(null, {
								user: {
									uid: uid
								}
							});
						} else {
							next(new Error('invalid-password'));
						}
					});
				});
			});
		}
	}

	Login.loginViaTwitter = function(twid, handle, photos, callback) {
		user.get_uid_by_twitter_id(twid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				user.create(handle, undefined, undefined, function(err, uid) {
					if (err !== null) {
						callback(err);
					} else {
						// Save twitter-specific information to the user
						user.setUserField(uid, 'twid', twid);
						RDB.hset('twid:uid', twid, uid);

						// Save their photo, if present
						if (photos && photos.length > 0) {
							var photoUrl = photos[0].value;
							photoUrl = path.dirname(photoUrl) + '/' + path.basename(photoUrl, path.extname(photoUrl)).slice(0, -6) + 'bigger' + path.extname(photoUrl);
							user.setUserField(uid, 'uploadedpicture', photoUrl);
							user.setUserField(uid, 'picture', photoUrl);
						}

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
						user.create(handle, undefined, email, function(err, uid) {
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
						user.create(name, undefined, email, function(err, uid) {
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