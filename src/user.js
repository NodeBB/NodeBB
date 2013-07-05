var utils = require('./../public/src/utils.js'),
	RDB = require('./redis.js'),
	crypto = require('crypto'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer),
	bcrypt = require('bcrypt'),
	marked = require('marked'),
	notifications = require('./notifications.js'),
	topics = require('./topics.js'),
	async = require('async');

(function(User) {
	User.getUserField = function(uid, field, callback) {
		RDB.hget('user:' + uid, field, function(err, data) {
			if(err === null) {
				callback(data);
			} else {
				console.log(err);
			}
		});
	}
	
	User.getUserFields = function(uid, fields, callback) {
		RDB.hmget('user:' + uid, fields, function(err, data) {
			if(err === null) {				
				for(var i = 0, returnData = {}, ii=fields.length; i<ii; ++i) {
					returnData[fields[i]] = data[i];
				}

				callback(returnData);
			} else {
				console.log(err);
			}
		});		
	}

	User.getMultipleUserFields = function(uids, fields, callback) {
		if(uids.length === 0) {
			callback({});
			return;
		}

		var data = {},
			loaded = 0;
			uuids = uids.filter(function(value, index, self) { 
			return self.indexOf(value) === index;
		});

		for (var i=0, ii=uuids.length; i<ii; i++) {
			(function(user_id) {
				User.getUserFields(user_id, fields, function(user_data) {
					data[user_id] = user_data;
					loaded ++;
					if (loaded == uuids.length) callback(data);
				});
			}(uuids[i]));
		}
	}

	User.getUserData = function(uid, callback) {
		RDB.hgetall('user:' + uid, function(err, data) {
			if(err === null) {
				if(data) {
					if(data['password'])
						delete data['password'];
				}
				callback(data);
			} else {
				console.log(err);
			}
		});
	}

	User.updateProfile = function(uid, data, callback) {

		var fields = ['email', 'fullname', 'website', 'location', 'birthday', 'signature'];

		if(data['signature'] !== undefined && data['signature'].length > 150) {
			callback({error:'Signature can\'t be longer than 150 characters!'});
			return;
		}

		for(var i = 0, key, ii = fields.length; i < ii; ++i) {
			key = fields[i];

			if(data[key] !== undefined) {
				if(key === 'email') {
					User.setUserField(uid, 'gravatarpicture', User.createGravatarURLFromEmail(data[key]));
					RDB.set('email:' + data['email'] +':uid', uid);
				} else if(key === 'signature') {
					data[key] = utils.strip_tags(data[key]);
				}
				
				User.setUserField(uid, key, data[key]);
			}
		}
		
		callback({});
	}

	User.setUserField = function(uid, field, value) {
		RDB.hset('user:' + uid, field, value);
	}

	User.incrementUserFieldBy = function(uid, field, value) {
		RDB.hincrby('user:' + uid, field, value);
	}

	User.getUserList = function(callback) {
		var data = [];
		
		RDB.keys('user:*', function(err, userkeys) {
			
			var anonUserIndex = userkeys.indexOf("user:0");
			if(anonUserIndex !== -1) {
				userkeys.splice(anonUserIndex, 1);
			}

			for(var i=0,ii=userkeys.length; i<ii; ++i) {
				var uid = userkeys[i].substr(5);
				
				User.getUserData(uid, function(userData) {
					data.push(userData);
					if(data.length === userkeys.length)
						callback(data);
				});
			}
		});
	}

	User.delete = function(uid, callback) {
		RDB.exists('user:'+uid, function(err, exists) {
			if(exists === 1) {
				console.log('deleting uid ' + uid);

				User.getUserData(uid, function(data) {
					RDB.del('username:' + data['username'] + ':uid');
					RDB.del('email:' + data['email'] +':uid');
					RDB.del('userslug:'+ data['userslug'] +':uid');

					RDB.del('user:' + uid);		
					RDB.del('followers:' + uid);
					RDB.del('following:' + uid);

					RDB.lrem('userlist', 1, data['username']);

					callback(true);	
				});
			} else {
				callback(false);
			}
		});
	}

	User.create = function(username, password, email, callback) {
		username = username.trim(), email = email.trim();

		// @todo return a proper error? use node-validator?
		if(!utils.isEmailValid(email) || !utils.isUserNameValid(username) || !utils.isPasswordValid(password)) {
			console.log('Invalid email/username/password!');
			callback(null, 0);
			return;
		}

		var userslug = utils.slugify(username);

		User.exists(userslug, function(exists) {
			if(exists) {
				callback(null, 0);
				return;
			}

			RDB.incr('global:next_user_id', function(err, uid) {
				RDB.handle(err);

				var gravatar = User.createGravatarURLFromEmail(email);

				RDB.hmset('user:'+uid, {
					'uid': uid,
					'username' : username,
					'userslug' : userslug,
					'fullname': '',
					'location':'',
					'birthday':'',
					'website':'',
					'email' : email,
					'signature':'',
					'joindate' : Date.now(),
					'picture': gravatar,
					'gravatarpicture' : gravatar,
					'uploadedpicture': '',
					'reputation': 0,
					'postcount': 0,
					'lastposttime': 0,
					'administrator': (uid == 1) ? 1 : 0
				});
				
				RDB.set('username:' + username + ':uid', uid);
				RDB.set('email:' + email +':uid', uid);
				RDB.set('userslug:'+ userslug +':uid', uid);
				
				if(email) {
					User.sendConfirmationEmail(email);
				}
			
				RDB.incr('usercount', function(err, count) {
					RDB.handle(err);
			
					io.sockets.emit('user.count', {count: count});
				});

				RDB.lpush('userlist', username);
				io.sockets.emit('user.latest', {userslug: userslug, username: username});

				if (password) {
					User.hashPassword(password, function(hash) {
						User.setUserField(uid, 'password', hash);
					});
				}

				callback(null, uid);
			});
		});
	};

	User.createGravatarURLFromEmail = function(email) {
		if (!email) {
			email = utils.generateUUID();
		}
		var md5sum = crypto.createHash('md5');
		md5sum.update(email.toLowerCase().trim());
		var gravatarURL = 'http://www.gravatar.com/avatar/' + md5sum.digest('hex') + '?default=identicon&s=128';
		return gravatarURL;
	}

	User.hashPassword = function(password, callback) {
		if(!password) {
			callback(password);
			return;
		}

		bcrypt.genSalt(10, function(err, salt) {
			bcrypt.hash(password, salt, function(err, hash) {
				callback(hash);	
			});
		});
	}

	User.search = function(username, callback) {
		if(!username) {
			callback([]);
			return;
		}

		RDB.keys('username:*'+ username + '*:uid', function(err, keys) {
			if(err === null) {
				if(keys && keys.length) {
					RDB.mget(keys, function(err, uids) {
						User.getDataForUsers(uids, function(userdata) {
							callback(userdata);
						});
					});			
				} else {
					callback([]);
				}
			} else {
				console.log(err);
			}
		});
	}

	User.onNewPostMade = function(uid, tid, pid, timestamp) {
		User.addPostIdToUser(uid, pid)
					
		User.incrementUserFieldBy(uid, 'postcount', 1);
		User.setUserField(uid, 'lastposttime', timestamp);

		User.sendPostNotificationToFollowers(uid, tid, pid);
	}

	User.addPostIdToUser = function(uid, pid) {
		RDB.lpush('uid:' + uid + ':posts', pid);
	}

	User.addTopicIdToUser = function(uid, tid) {
		RDB.lpush('uid:' + uid + ':topics', tid);
	}

	User.getPostIds = function(uid, start, end, callback) {
		RDB.lrange('uid:' + uid + ':posts', start, end, function(err, pids) {
			if(err === null) {
				if(pids && pids.length)
					callback(pids);
				else
					callback([]);
			}
			else {
				console.log(err);
				callback([]);
			}
		});
	}

	User.sendConfirmationEmail = function (email) {
		if (global.config['email:host'] && global.config['email:port'] && global.config['email:from']) {
			var confirm_code = utils.generateUUID(),
				confirm_link = config.url + 'confirm/' + confirm_code,
				confirm_email = global.templates['emails/header'] + global.templates['emails/email_confirm'].parse({'CONFIRM_LINK': confirm_link}) + global.templates['emails/footer'],
				confirm_email_plaintext = global.templates['emails/email_confirm_plaintext'].parse({ 'CONFIRM_LINK': confirm_link });

			// Email confirmation code
			var expiry_time = 60*60*2,	// Expire after 2 hours
				email_key = 'email:' + email + ':confirm',
				confirm_key = 'confirm:' + confirm_code + ':email';

			RDB.set(email_key, confirm_code);
			RDB.expire(email_key, expiry_time);
			RDB.set(confirm_key, email);
			RDB.expire(confirm_key, expiry_time);

				// Send intro email w/ confirm code
			var message = emailjs.message.create({
				text: confirm_email_plaintext,
				from: config.mailer.from,
				to: email,
				subject: '[NodeBB] Registration Email Verification',
				attachment: [
					{
						data: confirm_email,
						alternative: true
					}
				]
			});
				
			emailjsServer.send(message, function(err, success) {
				if (err) 
					console.log(err);
			});
		}
	}

	User.follow = function(uid, followid, callback) {
		RDB.sadd('following:'+uid, followid, function(err, data) {
			if(err === null) {
				RDB.sadd('followers:'+followid, uid, function(err, data) {
					callback(data);	
				});
			}
			else
				console.log(err);
		});
	}

	User.unfollow = function(uid, unfollowid, callback) {
		RDB.srem('following:'+uid, unfollowid, function(err, data){
			if(err === null) {
				RDB.srem('followers:'+unfollowid, uid, function(err, data){
					callback(data);
				});
			}
			else
				console.log(err);
		});
	}

	User.getFollowing = function(uid, callback) {
		RDB.smembers('following:'+uid, function(err, userIds) {
			if(err === null)
				User.getDataForUsers(userIds, callback);
			else
				console.log(err);	
		});
	}

	User.getFollowers = function(uid, callback) {
		RDB.smembers('followers:'+uid, function(err, userIds) {
			if(err === null)
				User.getDataForUsers(userIds, callback);
			else
				console.log(err);	
		});
	}
	
	User.getFollowingCount = function(uid, callback) {
		RDB.smembers('following:'+uid, function(err, userIds) {
			if(err === null)
				callback(userIds.length);
			else
				console.log(err);	
		});
	}
	
	User.getFollowerCount = function(uid, callback) {
		RDB.smembers('followers:'+uid, function(err, userIds) {
			if(err === null)
				callback(userIds.length);
			else
				console.log(err);	
		});
	}
	
	User.getDataForUsers = function(userIds, callback) {
		var returnData = [];

		if(!userIds || userIds.length === 0) {
			callback(returnData);
			return;
		}

		for(var i=0, ii=userIds.length; i<ii; ++i) {
			User.getUserData(userIds[i], function(userData) {
				returnData.push(userData);
				
				if(returnData.length == userIds.length)
					callback(returnData);			
			});	
		}
	}
	
	User.sendPostNotificationToFollowers = function(uid, tid, pid) {

		User.getUserField(uid, 'username', function(username) {
			RDB.smembers('followers:'+uid, function(err, followers) {
				
				topics.getTopicField(tid, 'slug', function(slug) {

					var message = username + ' made a new post';

					notifications.create(message, 5, global.config.url + 'topic/' + slug + '#' + pid, 'notification_'+ Date.now(), function(nid) {
		 				notifications.push(nid, followers);
					});
				});
			});
		});

	}

	User.isFollowing = function(uid, theirid, callback) {
		RDB.sismember('following:'+uid, theirid, function(err, data) {
			if(err === null)
				callback(data === 1);
			else
				console.log(err);
		});
	}

	User.exists = function(userslug, callback) {
		User.get_uid_by_userslug(userslug, function(exists) {
			exists = !!exists;

			if (callback) 
				callback(exists);
		});
	};
	
	User.count = function(socket) {
		RDB.get('usercount', function(err, count) {
			RDB.handle(err);
			socket.emit('user.count', {count: (count === null) ? 0 : count});
		});
	};
	
	User.latest = function(socket) {
		RDB.lrange('userlist', 0, 0, function(err, username) {
			RDB.handle(err);
			
			User.get_uid_by_username(username, function(uid) {
				
				User.getUserField(uid, 'userslug', function(userslug) {
					socket.emit('user.latest', {userslug: userslug, username: username});				
				});
			});
		});	
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_uid_by_userslug = function(userslug, callback) {
		RDB.get('userslug:' + userslug + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_usernames_by_uids = function(uids, callback) {
		var usernames = [];

		if (!Array.isArray(uids)) return callback([]);
		
		for(var i=0, ii=uids.length; i<ii; ++i) {
		
			User.getUserField(uids[i],'username', function(username) {

				usernames.push(username);

				if(usernames.length >= uids.length)
					callback(usernames);
			});
		}
	}

	User.get_userslugs_by_uids = function(uids, callback) {
		var userslugs = [];

		if (!Array.isArray(uids)) return callback([]);
		
		for(var i=0, ii=uids.length; i<ii; ++i) {
		
			User.getUserField(uids[i],'userslug', function(userslug) {

				userslugs.push(userslug);

				if(userslugs.length >= uids.length)
					callback(userslugs);
			});
		}
	}

	User.get_uid_by_email = function(email, callback) {
		RDB.get('email:' + email + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_uid_by_session = function(session, callback) {
		RDB.get('sess:' + session + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_uid_by_twitter_id = function(twid, callback) {
		RDB.hget('twid:uid', twid, function(err, uid) {
			RDB.handle(err);			
			callback(uid);
		});
	}

	User.get_uid_by_google_id = function(gplusid, callback) {
		RDB.hget('gplusid:uid', gplusid, function(err, uid) {
			RDB.handle(err);
			callback(uid);
		});	
	}

	User.get_uid_by_fbid = function(fbid, callback) {
		RDB.hget('fbid:uid', fbid, function(err, uid) {
			RDB.handle(err);
			callback(uid);
		});	
	}

	User.session_ping = function(sessionID, uid) {
		// Start, replace, or extend a session
		RDB.get('sess:' + sessionID, function(err, session) {
			RDB.handle(err);

			var expiry = 60*60*24*14, // Login valid for two weeks
				sess_key = 'sess:' + sessionID + ':uid',
				uid_key = 'uid:' + uid + ':session';

			RDB.set(sess_key, uid);
			RDB.expire(sess_key, expiry);
			RDB.set(uid_key, sessionID);
			RDB.expire(uid_key, expiry);
		});
	}

	User.isModerator = function(uid, cid, callback) {
		RDB.sismember('cid:' + cid + ':moderators', uid, function(err, exists) {
			callback(!!exists);
		});
	}

	User.isAdministrator = function(uid, callback) {
		RDB.sismember('administrators', uid, function(err, exists) {
			callback(!!exists);
		});
	}

	User.makeAdministrator = function(uid, callback) {
		RDB.sadd('administrators', uid, function(err, data){
			if(err === null) {
				User.setUserField(uid, 'administrator', 1);
			}
			if(callback)
				callback(err === null);
		});
	}

	User.removeAdministrator = function(uid, callback) {
		RDB.srem('administrators', uid, function(err, data){
			if(err === null) {
				User.setUserField(uid, 'administrator', 0);
			}
			if(callback)
				callback(err === null);
		});
	}	

	User.reset = {
		validate: function(socket, code, callback) {
			if (typeof callback !== 'function') callback = undefined;

			RDB.get('reset:' + code + ':uid', function(err, uid) {
				RDB.handle(err);

				if (uid !== null) {
					RDB.get('reset:' + code + ':expiry', function(err, expiry) {
						RDB.handle(err);

						if (expiry >= +new Date()/1000|0) {
							if (!callback) socket.emit('user:reset.valid', { valid: true });
							else callback(true);
						} else {
							// Expired, delete from db
							RDB.del('reset:' + code + ':uid');
							RDB.del('reset:' + code + ':expiry');
							if (!callback) socket.emit('user:reset.valid', { valid: false });
							else callback(false);
						}
					});
				} else {
					if (!callback) socket.emit('user:reset.valid', { valid: false });
					else callback(false);
				}
			});
		},
		send: function(socket, email) {
			User.get_uid_by_email(email, function(uid) {
				if (uid !== null) {
					// Generate a new reset code
					var reset_code = utils.generateUUID();
					RDB.set('reset:' + reset_code + ':uid', uid);
					RDB.set('reset:' + reset_code + ':expiry', (60*60)+new Date()/1000|0);	// Active for one hour

					var reset_link = config.url + 'reset/' + reset_code,
						reset_email = global.templates['emails/reset'].parse({'RESET_LINK': reset_link}),
						reset_email_plaintext = global.templates['emails/reset_plaintext'].parse({ 'RESET_LINK': reset_link });

					var message = emailjs.message.create({
						text: reset_email_plaintext,
						from: config.mailer.from,
						to: email,
						subject: 'Password Reset Requested',
						attachment: [
							{
								data: reset_email,
								alternative: true
							}
						]
					});
					
					emailjsServer.send(message, function(err, success) {
						if (err === null) {
							socket.emit('user.send_reset', {
								status: "ok",
								message: "code-sent",
								email: email
							});
						} else {
							socket.emit('user.send_reset', {
								status: "error",
								message: "send-failed"
							});
							throw new Error(err);
						}
					});
				} else {
					socket.emit('user.send_reset', {
						status: "error",
						message: "invalid-email",
						email: email
					});
				}
			});
		},
		commit: function(socket, code, password) {
			this.validate(code, function(validated) {
				if (validated) {
					RDB.get('reset:' + code + ':uid', function(err, uid) {
						RDB.handle(err);

						User.setUserField(uid, 'password', password);
						RDB.del('reset:' + code + ':uid');
						RDB.del('reset:' + code + ':expiry');

						socket.emit('user:reset.commit', { status: 'ok' });
					});
				}
			});
		}
	}

	User.email = {
		exists: function(socket, email, callback) {
			User.get_uid_by_email(email, function(exists) {
				exists = !!exists;
				if (typeof callback !== 'function') socket.emit('user.email.exists', { exists: exists });
				else callback(exists);
			});
		},
		confirm: function(code, callback) {
			RDB.get('confirm:' + code + ':email', function(err, email) {
				RDB.handle(err);

				if (email !== null) {
					RDB.set('email:' + email + ':confirm', true);
					RDB.del('confirm:' + code + ':email');
					callback({
						status: 'ok'
					});
				} else {
					callback({
						status: 'not_ok'
					});
				}
			});
		}
	};

	User.get_online_users = function(socket, uids) {
		RDB.sismembers('users:online', uids, function(err, data) {
			socket.emit('api:user.get_online_users', data);
		});		
	};

	User.go_online = function(uid) {
		RDB.sadd('users:online', uid, function(err) {
			if (err) RDB.handle(err);
		});
	};

	User.go_offline = function(uid) {
		RDB.srem('users:online', uid, function(err) {
			if (err) RDB.handle(err);
		});
	};


	User.active = {
		get_record : function(socket) {
			RDB.mget(['global:active_user_record', 'global:active_user_record_date'], function(err, data) {
				RDB.handle(err);
				socket.emit('api:user.active.get_record', {record: data[0], timestamp: data[1]});
			});
		},

		get: function(callback) {
			function user_record(total) {
				RDB.get('global:active_user_record', function(err, record) {
					RDB.handle(err);

					if (total > record) {
						RDB.set('global:active_user_record', total);
						RDB.set('global:active_user_record_date', Date.now());
					}
				});
			}

			RDB.keys('active:*', function(err, active) {
				RDB.handle(err);

				var	returnObj = {
						users: 0,
						anon: 0,
						uids: []
					},
					keys = [];

				if (active.length > 0) {
					for(var a in active) {
						keys.push('sess:' + active[a].split(':')[1] + ':uid');
					}

					RDB.mget(keys, function(err, uids) {
						RDB.handle(err);

						for(var u in uids) {
							if (uids[u] !== null) {
								if (returnObj.uids.indexOf(uids[u]) === -1) {
									returnObj.users++;
									returnObj.uids.push(uids[u]);
								}
							} else {
								returnObj.anon++;
							}
						}

						user_record(returnObj.anon + returnObj.users);

						if (callback === undefined) {
							io.sockets.emit('api:user.active.get', returnObj)
						} else {
							callback(returnObj);
						}
					});
				} else {
					io.sockets.emit('api:user.active.get', returnObj)
				}
			});
		},
		register: function(sessionID) {
			// Active state persists for 10 minutes
			var active_session = 'active:' + sessionID;
			RDB.set(active_session, '');
			RDB.expire(active_session, 60*10)
			this.get();
		}
	}

	User.notifications = {
		get: function(uid, callback) {
			async.parallel({
				unread: function(next) {
					RDB.zrevrangebyscore('uid:' + uid + ':notifications:unread', 10, 0, function(err, nids) {
						var unread = [];
						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, function(notif_data) {
									unread.push(notif_data);
									next();
								});
							}, function(err) {
								next(null, unread);
							});
						} else next(null, unread);
					});
				},
				read: function(next) {
					RDB.zrevrangebyscore('uid:' + uid + ':notifications:read', 10, 0, function(err, nids) {
						var read = [];
						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, function(notif_data) {
									read.push(notif_data);
									next();
								});
							}, function(err) {
								next(null, read);
							});
						} else next(null, read);
					});
				}
			}, function(err, notifications) {
				// While maintaining score sorting, sort by time
				notifications.read.sort(function(a, b) {
					if (a.score === b.score) return (a.datetime - b.datetime) > 0 ? -1 : 1;
				});
				notifications.unread.sort(function(a, b) {
					if (a.score === b.score) return (a.datetime - b.datetime) > 0 ? -1 : 1;
				});
				callback(notifications);
			});
		},
		hasFlag: function(uid, callback) {
			RDB.get('uid:1:notifications:flag', function(err, flag) {
				if (err) RDB.handle(err);

				if (flag === '1') callback(true);
				else callback(false);
			});
		},
		removeFlag: function(uid) {
			RDB.del('uid:' + uid + ':notifications:flag', function(err) {
				if (err) RDB.handle(err);
			});
		}
	}
}(exports));
