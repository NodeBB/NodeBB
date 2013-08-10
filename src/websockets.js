
var SocketIO = require('socket.io').listen(global.server, { log:false }),
	cookie = require('cookie'),
	express = require('express'),
	user = require('./user.js'),
	posts = require('./posts.js'),
	favourites = require('./favourites.js'),
	utils = require('../public/src/utils.js'),
	util = require('util'),
	topics = require('./topics.js'),
	categories = require('./categories.js'),
	notifications = require('./notifications.js'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools.js'),
	meta = require('./meta.js'),
	async = require('async'),
	RedisStoreLib = require('connect-redis')(express),
	redis = require('redis'),
	redisServer = redis.createClient(global.nconf.get('redis:port'), global.nconf.get('redis:host')),
	RedisStore = new RedisStoreLib({
		client: redisServer,
		ttl: 60*60*24*14
	}),
	socketCookieParser = express.cookieParser(global.nconf.get('secret')),
	admin = {
		'categories': require('./admin/categories.js'),
		'user': require('./admin/user.js')
	},
	plugins = require('./plugins');
	
(function(io) {
	var	users = {},
		userSockets = {},
		rooms = {}

	global.io = io;

	io.sockets.on('connection', function(socket) {
		var	hs = socket.handshake,
			sessionID, uid;

		// Validate the session, if present
		socketCookieParser(hs, {}, function(err) {
			sessionID = socket.handshake.signedCookies["express.sid"];
			RedisStore.get(sessionID, function(err, sessionData) {
				if (!err && sessionData && sessionData.passport && sessionData.passport.user) uid = users[sessionID] = sessionData.passport.user;
				else uid = users[sessionID] = 0;

				userSockets[uid] = userSockets[uid] || [];
				userSockets[uid].push(socket);
				
				if(uid) {
					socket.join('uid_' + uid);
					io.sockets.in('global').emit('api:user.isOnline', isUserOnline(uid));
				
					user.getUserField(uid, 'username', function(username) {
						socket.emit('event:connect', {status: 1, username:username});
					});
				}
			});
		});

		
		
		socket.on('disconnect', function() {
			
			var index = userSockets[uid].indexOf(socket);
			if(index !== -1) {
				userSockets[uid].splice(index, 1);
			}

			if(userSockets[uid].length === 0) {
				delete users[sessionID];
				if(uid)
					io.sockets.in('global').emit('api:user.isOnline', isUserOnline(uid));
			}			
			
			for(var roomName in rooms) {

				socket.leave(roomName);

				if(rooms[roomName][socket.id]) {
					delete rooms[roomName][socket.id];
				}	
				
				updateRoomBrowsingText(roomName);									
			}
		});

		socket.on('api:get_all_rooms', function(data) {
			socket.emit('api:get_all_rooms', io.sockets.manager.rooms);
		})

		function updateRoomBrowsingText(roomName) {

			function getUidsInRoom(room) {
				var uids = [];
				for(var socketId in room) {
					if(uids.indexOf(room[socketId]) === -1)
						uids.push(room[socketId]);
				}
				return uids;
			}

			function getAnonymousCount(roomName) {
				var clients = io.sockets.clients(roomName);
				var anonCount = 0;
				
				for(var i=0; i<clients.length; ++i) {
					var hs = clients[i].handshake;

					if(hs && !users[sessionID]) {
						++anonCount;
					}
				}
				return anonCount;				
			}

			var uids = getUidsInRoom(rooms[roomName]);
			
			var anonymousCount = getAnonymousCount(roomName);

			function userList(users, anonymousCount, userCount) {
				var usernames = [];

				for (var i = 0, ii=users.length; i<ii; ++i) {
					usernames[i] = '<strong>' + '<a href="/users/'+users[i].userslug+'">' + users[i].username + '</a></strong>';
				}
				
				var joiner = anonymousCount + userCount == 1 ? 'is' : 'are', 
				userList = anonymousCount > 0 ? usernames.concat(util.format('%d guest%s', anonymousCount, anonymousCount > 1 ? 's' : '')) : usernames,
				lastUser = userList.length > 1 ? ' and ' + userList.pop() : '';

				return util.format('%s%s %s browsing this thread', userList.join(', '), lastUser, joiner);
			}


			if (uids.length === 0) {
				io.sockets.in(roomName).emit('api:get_users_in_room', userList([], anonymousCount, 0));
			} else {
				user.getMultipleUserFields(uids, ['username', 'userslug'], function(users) {
					io.sockets.in(roomName).emit('api:get_users_in_room', userList(users, anonymousCount, users.length));
				});
			}
		}

		socket.on('event:enter_room', function(data) {
			
			if (data.leave !== null) {
				socket.leave(data.leave);
			}
				
			socket.join(data.enter);

			rooms[data.enter] = rooms[data.enter] || {};

			if (uid) {
				rooms[data.enter][socket.id] = uid;
				
				if (data.leave && rooms[data.leave] && rooms[data.leave][socket.id]) {
					delete rooms[data.leave][socket.id];
				}
			}

			if(data.leave)
				updateRoomBrowsingText(data.leave);

			updateRoomBrowsingText(data.enter);

			if (data.enter != 'admin') 
				io.sockets.in('admin').emit('api:get_all_rooms', io.sockets.manager.rooms);
			
		});

		// BEGIN: API calls (todo: organize)

		socket.on('api:updateHeader', function(data) {
			if(uid) {
				user.getUserFields(uid, data.fields, function(fields) {
					fields.uid = uid;
					socket.emit('api:updateHeader', fields);
				});
			}
			else {
				socket.emit('api:updateHeader', {
					uid:0,
					username: "Anonymous User",
					email: '',
					picture: require('gravatar').url('', {s:'24'}, https=global.nconf.get('https'))
				});
			}
				
		});
		
		socket.on('user.exists', function(data) {
			user.exists(utils.slugify(data.username), function(exists){
				socket.emit('user.exists', {exists: exists});
			});
		});

		socket.on('user.count', function(data) {
			user.count(socket, data);
		});

		socket.on('post.stats', function(data) {
			posts.getTopicPostStats(socket);
		});

		socket.on('user.latest', function(data) {
			user.latest(socket, data);
		});

		socket.on('user.email.exists', function(data) {
			user.email.exists(socket, data.email);
		});

		socket.on('user:reset.send', function(data) {
			user.reset.send(socket, data.email);
		});

		socket.on('user:reset.valid', function(data) {
			user.reset.validate(socket, data.code);
		});

		socket.on('user:reset.commit', function(data) {
			user.reset.commit(socket, data.code, data.password);
		});

		function isUserOnline(uid) {
			return !!userSockets[uid] && userSockets[uid].length > 0;
		}

		socket.on('api:user.get_online_users', function(data) {
			var returnData = [];
			
			for(var i=0; i<data.length; ++i) {
				var uid = data[i];
				if(isUserOnline(uid))
					returnData.push(uid);
				else 
					returnData.push(0);
			}
			socket.emit('api:user.get_online_users', returnData);
		});

		socket.on('api:user.isOnline', function(uid) {
			socket.emit('api:user.isOnline', isUserOnline(uid));
		});

		socket.on('api:user.changePassword', function(data, callback) {
			user.changePassword(uid, data, callback);
		});
				   
		socket.on('api:user.updateProfile', function(data, callback) {
			user.updateProfile(uid, data, callback);
		});

		socket.on('api:user.changePicture', function(data, callback) {
			
			var type = data.type;

			function updateHeader() {
				user.getUserFields(uid, ['picture'], function(fields) {
					fields.uid = uid;
					socket.emit('api:updateHeader', fields);
					callback(true);
				});
			}

			if(type === 'gravatar') {
				user.getUserField(uid, 'gravatarpicture', function(gravatar) {
					user.setUserField(uid, 'picture', gravatar);
					updateHeader();
				});
			} else if(type === 'uploaded') {
				user.getUserField(uid, 'uploadedpicture', function(uploadedpicture) {
					user.setUserField(uid, 'picture', uploadedpicture);
					updateHeader();
				});
			} else {
				callback(false);
			}
		});

		socket.on('api:user.follow', function(data, callback) {
			if(uid) { 
				user.follow(uid, data.uid, callback);
			}
		});

		socket.on('api:user.unfollow', function(data, callback) {
			if(uid) {
				user.unfollow(uid, data.uid, callback);
			}
		});

		socket.on('api:user.saveSettings', function(data, callback) {
			if(uid) {
				user.setUserFields(uid, {
					showemail:data.showemail
				});
				callback(true);
			}
		});

		socket.on('api:topics.post', function(data) {

			topics.post(uid, data.title, data.content, data.category_id, data.images, function(err, result) {
				if(err) {
					if(err.message === 'not-logged-in') {
						socket.emit('event:alert', {
							title: 'Thank you for posting',
							message: 'Since you are unregistered, your post is awaiting approval. Click here to register now.',
							type: 'warning',
							timeout: 7500,
							clickfn: function() {
								ajaxify.go('register');
							}
						});
					} else if(err.message === 'title-too-short') {
						topics.emitTitleTooShortAlert(socket);
					} else if(err.message === 'content-too-short') {
						posts.emitContentTooShortAlert(socket);
					} else if (err.message === 'too-many-posts') {
						posts.emitTooManyPostsAlert(socket);
					}
					return;
				}
				
				if(result) {
					posts.getTopicPostStats(socket);
					
					socket.emit('event:alert', {
						title: 'Thank you for posting',
						message: 'You have successfully posted. Click here to view your post.',
						type: 'notify',
						timeout: 2000
					});
				}				
			});
			
		});
		
		socket.on('api:topics.markAllRead', function(data, callback) {
			topics.markAllRead(uid, function(err, success) {
				if(!err && success)	{
					callback(true);
				} else {
					callback(false);
				}
			});
		});

		socket.on('api:posts.reply', function(data) {
			if(uid < 1) {
				socket.emit('event:alert', {
					title: 'Reply Unsuccessful',
					message: 'You don&apos;t seem to be logged in, so you cannot reply.',
					type: 'error',
					timeout: 2000
				});
				return;
			}
			
			posts.reply(data.topic_id, uid, data.content, data.images, function(err, result) {
				if(err) {
					if(err.message === 'content-too-short') {
						posts.emitContentTooShortAlert(socket);
					} else if(err.messages === 'too-many-posts') {
						posts.emitTooManyPostsAlert(socket);
					} else if(err.message === 'reply-error') {
						socket.emit('event:alert', {
							title: 'Reply Unsuccessful',
							message: 'Your reply could not be posted at this time. Please try again later.',
							type: 'notify',
							timeout: 2000
						});
					}
					return;
				}
				
				if(result) {
					
					posts.getTopicPostStats(socket);
					
					socket.emit('event:alert', {
						title: 'Reply Successful',
						message: 'You have successfully replied. Click here to view your reply.',
						type: 'notify',
						timeout: 2000
					});
					
				}
				
			});
		});

		socket.on('api:user.active.get', function() {
			user.active.get();
		});

		socket.on('api:posts.favourite', function(data) {
			favourites.favourite(data.pid, data.room_id, uid, socket);
		});

		socket.on('api:posts.unfavourite', function(data) {
			favourites.unfavourite(data.pid, data.room_id, uid, socket);
		});

		socket.on('api:user.active.get_record', function() {
			user.active.get_record(socket);
		});

		socket.on('api:topic.delete', function(data) {
			threadTools.delete(data.tid, uid, function(err) {
				if (!err) {
					socket.emit('api:topic.delete', {
						status: 'ok',
						tid: data.tid
					});
				}
			});
		});

		socket.on('api:topic.restore', function(data) {
			threadTools.restore(data.tid, uid, socket);
		});

		socket.on('api:topic.lock', function(data) {
			threadTools.lock(data.tid, uid, socket);
		});

		socket.on('api:topic.unlock', function(data) {
			threadTools.unlock(data.tid, uid, socket);
		});

		socket.on('api:topic.pin', function(data) {
			threadTools.pin(data.tid, uid, socket);
		});

		socket.on('api:topic.unpin', function(data) {
			threadTools.unpin(data.tid, uid, socket);
		});

		socket.on('api:topic.move', function(data) {
			threadTools.move(data.tid, data.cid, socket);
		});

		socket.on('api:categories.get', function() {
			categories.getAllCategories(function(categories) {
				socket.emit('api:categories.get', categories);
			});
		});

		socket.on('api:posts.getRawPost', function(data) {
			posts.getPostField(data.pid, 'content', function(raw) {
				socket.emit('api:posts.getRawPost', { post: raw });
			});
		});

		socket.on('api:posts.edit', function(data) {
			if(!data.title || data.title.length < topics.minimumTitleLength) {
				topics.emitTitleTooShortAlert(socket);
				return;
			} else if (!data.content || data.content.length < posts.minimumPostLength) {
				posts.emitContentTooShortAlert(socket);
				return;
			}
			postTools.edit(uid, data.pid, data.title, data.content);
		});

		socket.on('api:posts.delete', function(data) {
			postTools.delete(uid, data.pid);
		});

		socket.on('api:posts.restore', function(data) {
			postTools.restore(uid, data.pid);
		});

		socket.on('api:notifications.get', function(data) {
			user.notifications.get(uid, function(notifs) {
				socket.emit('api:notifications.get', notifs);
			});
		});

		socket.on('api:notifications.mark_read', function(nid) {
			notifications.mark_read(nid, uid);
		});

		socket.on('api:notifications.mark_all_read', function(data, callback) {
			notifications.mark_all_read(uid, function(err) {
				if (!err) callback();
			});
		});

		socket.on('api:categories.getRecentReplies', function(tid) {
			categories.getRecentReplies(tid, 4, function(replies) {
				socket.emit('api:categories.getRecentReplies', replies);
			});
		});

		socket.on('sendChatMessage', function(data) {

			var touid = data.touid;

			if(userSockets[touid]) {
				var msg = utils.strip_tags(data.message),
					numSockets = userSockets[touid].length;

				user.getUserField(uid, 'username', function(username) {
					var finalMessage = username + ' says : ' + msg;

					for(var x=0;x<numSockets;x++) {
						userSockets[touid][x].emit('chatMessage', {fromuid:uid, username:username, message:finalMessage});
					}
					
					notifications.create(finalMessage, 5, '#', 'notification_'+uid+'_'+touid, function(nid) {
						notifications.push(nid, [touid], function(success) {
							
						});
					});
				});
			}
		});

		socket.on('api:config.get', function(data) {
			meta.config.get(function(config) {
				socket.emit('api:config.get', config);
			});
		});

		socket.on('api:config.set', function(data) {
			meta.config.set(data.key, data.value, function(err) {
				if (!err) socket.emit('api:config.set', { status: 'ok' });
			});
		});

		socket.on('api:config.remove', function(key) {
			meta.config.remove(key);
		});

		socket.on('api:composer.push', function(data) {
			if (uid > 0) {
				if (parseInt(data.tid) > 0) {
					topics.getTopicData(data.tid, function(topicData) {

						if (data.body) 
							topicData.body = data.body;

						socket.emit('api:composer.push', {
							tid: data.tid,
							title: topicData.title,
							body: topicData.body
						});
					});
				} else if (parseInt(data.cid) > 0) {
					user.getUserFields(uid, ['username', 'picture'], function(userData) {
						socket.emit('api:composer.push', {
							tid: 0,
							cid: data.cid,
							username: userData.username,
							picture: userData.picture,
							title: undefined
						});
					});
				} else if (parseInt(data.pid) > 0) {
					async.parallel([
						function(next) {
							posts.getPostField(data.pid, 'content', function(raw) {
								next(null, raw);
							});
						},
						function(next) {
							topics.getTitleByPid(data.pid, function(title) {
								next(null, title);
							});
						}
					], function(err, results) {
						socket.emit('api:composer.push', {
							title: results[1],
							pid: data.pid,
							body: results[0]
						});
					});
				}
			} else {
				socket.emit('api:composer.push', {
					error: 'no-uid'
				});
			}
		});

		socket.on('api:composer.editCheck', function(pid) {
			posts.getPostField(pid, 'tid', function(tid) {
				postTools.isMain(pid, tid, function(isMain) {
					socket.emit('api:composer.editCheck', {
						titleEditable: isMain
					});
				})
			})
		});

		socket.on('api:post.privileges', function(pid) {
			postTools.privileges(pid, uid, function(privileges) {
				privileges.pid = parseInt(pid);
				socket.emit('api:post.privileges', privileges);
			});
		});

		socket.on('api:topic.followCheck', function(tid) {
			threadTools.isFollowing(tid, uid, function(following) {
				socket.emit('api:topic.followCheck', following);
			});
		});

		socket.on('api:topic.follow', function(tid) {
			if (uid && uid > 0) {
				threadTools.toggleFollow(tid, uid, function(follow) {
					if (follow.status === 'ok') socket.emit('api:topic.follow', follow);
				});
			} else {
				socket.emit('api:topic.follow', {
					status: 'error',
					error: 'not-logged-in'
				});
			}
		});

		socket.on('api:topic.loadMore', function(data, callback) {
			var	start = data.after,
				end = start + 9;
			
			topics.getTopicPosts(data.tid, start, end, uid, function(posts) {
				callback({posts:posts});
			});
		});
		
		socket.on('api:category.loadMore', function(data, callback) {
			var start = data.after,
				end = start + 9;
			
			categories.getCategoryTopics(data.cid, start, end, uid, function(topics) {
				callback({topics:topics});
			});
		});

		socket.on('api:topics.loadMoreRecentTopics', function(data, callback) {
			var start = data.after,
				end = start + 9;

			topics.getLatestTopics(uid, start, end, function(latestTopics) {
				callback(latestTopics);
			});
		});
		
		socket.on('api:topics.loadMoreUnreadTopics', function(data, callback) {
			var start = data.after,
				end = start + 9;
			
			console.log(start, end);
			topics.getUnreadTopics(uid, start, end, function(unreadTopics) {
				callback(unreadTopics);
			});
		});

		socket.on('api:admin.topics.getMore', function(data) {
			topics.getAllTopics(data.limit, data.after, function(topics) {
				socket.emit('api:admin.topics.getMore', JSON.stringify(topics));
			});
		});

		socket.on('api:admin.categories.update', function(data) {
			admin.categories.update(data, socket);
		});
		
		socket.on('api:admin.user.makeAdmin', function(theirid) {
			if(uid && uid > 0) {
				admin.user.makeAdmin(uid, theirid, socket);
			}
		});
		
		socket.on('api:admin.user.removeAdmin', function(theirid) {
			if(uid && uid > 0) {
				admin.user.removeAdmin(uid, theirid, socket);
			}
		});

		socket.on('api:admin.user.deleteUser', function(theirid) {
			if(uid && uid > 0) {
				admin.user.deleteUser(uid, theirid, socket);
			}
		});

		socket.on('api:admin.user.search', function(username) {
			if(uid && uid > 0) {
				user.search(username, function(data) {
					socket.emit('api:admin.user.search', data);
				});
			}
			else
				socket.emit('api:admin.user.search', null);
		});

		socket.on('api:admin:themes.getInstalled', function() {
			meta.themes.get(function(err, themeArr) {
				socket.emit('api:admin:themes.getInstalled', themeArr);
			});
		});

		socket.on('api:admin.plugins.toggle', function(plugin_id) {
			plugins.toggleActive(plugin_id, function(status) {
				socket.emit('api:admin.plugins.toggle', status);
			});
		});
	});
	
}(SocketIO));
