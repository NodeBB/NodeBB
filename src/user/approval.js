
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	request = require('request'),

	db = require('./../database'),
	meta = require('../meta'),
	emailer = require('../emailer'),
	notifications = require('../notifications'),
	translator = require('../../public/src/modules/translator'),
	utils = require('../../public/src/utils');


module.exports = function(User) {

	User.addToApprovalQueue = function(userData, callback) {
		userData.userslug = utils.slugify(userData.username);
		async.waterfall([
			function(next) {
				User.isDataValid(userData, next);
			},
			function(next) {
				User.hashPassword(userData.password, next);
			},
			function(hashedPassword, next) {
				var data = {
					username: userData.username,
					email: userData.email,
					ip: userData.ip,
					hashedPassword: hashedPassword
				};

				db.setObject('registration:queue:name:' + userData.username, data, next);
			},
			function(next) {
				db.sortedSetAdd('registration:queue', Date.now(), userData.username, next);
			},
			function(next) {
				sendNotificationToAdmins(userData.username, next);
			}
		], callback);
	};

	function sendNotificationToAdmins(username, callback) {
		notifications.create({
			bodyShort: '[[notifications:new_register, ' + username + ']]',
			nid: 'new_register:' + username,
			path: '/admin/manage/users/registration'
		}, function(err, notification) {
			if (err) {
				return callback(err);
			}
			if (notification) {
				notifications.pushGroup(notification, 'administrators', callback);
			} else {
				callback();
			}
		});
	}

	User.acceptRegistration = function(username, callback) {
		var uid;
		var userData;
		async.waterfall([
			function(next) {
				db.getObject('registration:queue:name:' + username, next);
			},
			function(_userData, next) {
				if (!_userData) {
					return callback(new Error('[[error:invalid-data]]'));
				}
				userData = _userData;
				User.create(userData, next);
			},
			function(_uid, next) {
				uid = _uid;
				User.setUserField(uid, 'password', userData.hashedPassword, next);
			},
			function(next) {
				var title = meta.config.title || meta.config.browserTitle || 'NodeBB';
				translator.translate('[[email:welcome-to, ' + title + ']]', meta.config.defaultLang, function(subject) {
					var data = {
						site_title: title,
						username: username,
						subject: subject,
						template: 'registration_accepted',
						uid: uid
					};

					emailer.send('registration_accepted', uid, data, next);
				});
			},
			function(next) {
				User.notifications.sendWelcomeNotification(uid, next);
			},
			function(next) {
				removeFromQueue(username, next);
			}
		], callback);
	};

	User.rejectRegistration = function(username, callback) {
		removeFromQueue(username, callback);
	};

	function removeFromQueue(username, callback) {
		async.parallel([
			async.apply(db.sortedSetRemove, 'registration:queue', username),
			async.apply(db.delete, 'registration:queue:name:' + username)
		], callback);
	}

	User.getRegistrationQueue = function(start, stop, callback) {
		var data;
		async.waterfall([
			function(next) {
				db.getSortedSetRevRangeWithScores('registration:queue', start, stop, next);
			},
			function(_data, next) {
				data = _data;
				var keys = data.filter(Boolean).map(function(user) {
					return 'registration:queue:name:' + user.value;
				});
				db.getObjects(keys, next);
			},
			function(users, next) {
				users.forEach(function(user, index) {
					if (user) {
						user.timestamp = utils.toISOString(data[index].score);
					}
				});

				async.map(users, function(user, next) {
					if (!user) {
						return next(null, user);
					}

					request('http://api.stopforumspam.org/api?ip=' + user.ip + '&email=' + user.email + '&username=' + user.username + '&f=json', function (err, response, body) {
						if (err) {
							return next(null, user);
						}
						if (response.statusCode === 200) {
							var data = JSON.parse(body);
							user.spamData = data;

							user.usernameSpam = data.username.frequency > 0 || data.username.appears > 0;
							user.emailSpam = data.email.frequency > 0 || data.email.appears > 0;
							user.ipSpam = data.ip.frequency > 0 || data.ip.appears > 0;
						}
						next(null, user);
					});
				}, next);
			}
		], callback);
	};


};
