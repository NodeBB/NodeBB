
var SocketIO = require('socket.io').listen(global.server, { log:false }),
	cookie = require('cookie'),
	connect = require('connect'),
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
	admin = {
		'categories': require('./admin/categories.js'),
		'user': require('./admin/user.js')
	};
	
(function(io) {
	var	users = {},
		userSockets = {},
		rooms = {}

	global.io = io;

	// Adapted from http://howtonode.org/socket-io-auth
	io.set('authorization', function(handshakeData, accept) {
		if (handshakeData.headers.cookie) {
			handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
			handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], global.nconf.get('secret'));

			if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
				return accept('Cookie is invalid.', false);
			}
		} else {
			// No cookie sent
			return accept('No cookie transmitted', false);
		}

		// Otherwise, continue unimpeded.
		var sessionID = handshakeData.sessionID;
		
		user.get_uid_by_session(sessionID, function(userId) {
			if (userId)
				users[sessionID] = userId;
			else 
				users[sessionID] = 0;

			accept(null, true);
		});
	});

	io.sockets.on('connection', function(socket) {
		
		var hs = socket.handshake;

		var uid = users[hs.sessionID];
		// if (uid > 0) {
			userSockets[uid] = userSockets[uid] || [];
			userSockets[uid].push(socket);
			user.go_online(uid);
			
			socket.join('uid_' + uid);
		// }
		
		/*process.on('uncaughtException', function(err) {
			// handle the error safely
			console.log("error message "+err);
			socket.emit('event:consolelog',{type:'uncaughtException', stack:err.stack, error:err.toString()});
		});*/

		socket.emit('event:connect', {status: 1});
		
		socket.on('disconnect', function() {
			// if (uid > 0) {
				user.go_offline(uid);
				delete users[hs.sessionID];
				var index = userSockets[uid].indexOf(socket);
				if(index !== -1) {
					userSockets[uid].splice(index, 1);
				}
				
				for(var roomName in rooms) {

					socket.leave(roomName);

					if(rooms[roomName][hs.sessionID]) {
						delete rooms[roomName][hs.sessionID];
					}	
					
					updateRoomBrowsingText(roomName);									
				}
				
			// }
		});

		socket.on('api:get_all_rooms', function(data) {
			socket.emit('api:get_all_rooms', io.sockets.manager.rooms);
		})

		function updateRoomBrowsingText(roomName) {

			function getUidsInRoom(room) {
				var uids = [];
				for(var sessionId in room) {
					if(uids.indexOf(room[sessionId]) === -1)
						uids.push(room[sessionId]);
				}
				return uids;
			}

			function getAnonymousCount(roomName) {
				var clients = io.sockets.clients(roomName);
				var anonCount = 0;
				
				for(var i=0; i<clients.length; ++i) {
					var hs = clients[i].handshake;
					if(hs && !users[hs.sessionID]) {
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

			if(data.leave) {
				if (uid) {
					rooms[data.enter][hs.sessionID] = uid;
				
					if (data.leave && rooms[data.leave] && rooms[data.leave][hs.sessionID]) {
						delete rooms[data.leave][hs.sessionID];
					}
				}
				updateRoomBrowsingText(data.leave);
			}
			
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

		socket.on('api:user.get_online_users', function(data) {
			user.get_online_users(socket, data);
		});

		socket.on('api:user.changePassword', function(data) {
			user.changePassword(socket, uid, data, function(success) {
				if(success) {
					socket.emit('api:user.changePassword');
				}
			});
		});
				   
		socket.on('api:user.updateProfile', function(data) {
			user.updateProfile(socket, uid, data);
		});

		socket.on('api:user.changePicture', function(data) {
			
			var type = data.type;

			function updateHeader() {
				user.getUserFields(uid, ['picture'], function(fields) {
					fields.uid = uid;
					socket.emit('api:updateHeader', fields);
				});
			}

			if(type === 'gravatar') {	
				user.getUserField(uid, 'gravatarpicture', function(gravatar) {
					user.setUserField(uid, 'picture', gravatar);
					updateHeader();
				});
			}
			else if(type === 'uploaded') {
				user.getUserField(uid, 'uploadedpicture', function(uploadedpicture) {
					user.setUserField(uid, 'picture', uploadedpicture);
					updateHeader();
				});
			}
			
		});


		socket.on('api:user.follow', function(data) {
			
			user.follow(uid, data.uid, function(success) {
				if(success) {
					user.getUserField(data.uid, 'username', function(username) {
						socket.emit('event:alert', {
							title: 'Following',
							message: 'You are now following ' + username + '!',
							type: 'success',
							timeout: 2000
						});		
					});
				}
			});
		});

		socket.on('api:user.unfollow', function(data) {
			
			user.unfollow(uid, data.uid, function(success) {
				if(success) {
					user.getUserField(data.uid, 'username', function(username) {
						socket.emit('event:alert', {
							title: 'Unfollowed',
							message: 'You are no longer following ' + username + '!',
							type: 'success',
							timeout: 2000
						});		
					});
				}
			});
		});

		socket.on('api:topics.post', function(data) {
			topics.post(socket, uid, data.title, data.content, data.category_id);
		});

		socket.on('api:posts.reply', function(data) {
			posts.reply(socket, data.topic_id, uid, data.content);
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
			if(!data.title || data.title.length <= 3) {
				socket.emit('event:alert', {
					type: 'error',
					timeout: 5000,
					title: 'Title too short',
					message: "Please enter a longer title.",
					alert_id: 'post_error'
				});
				return;
			} else if (!data.content || data.content.length <= 9) {
				socket.emit('event:alert', {
					type: 'error',
					timeout: 5000,
					title: 'Content too short',
					message: "Please enter a longer post.",
					alert_id: 'post_error'
				});
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

		socket.on('api:notifications.hasFlag', function(data) {
			user.notifications.hasFlag(uid, function(flag) {
				socket.emit('api:notifications.hasFlag', flag);
			});
		});

		socket.on('api:notifications.removeFlag', function() {
			user.notifications.removeFlag(uid);
		});

		socket.on('api:notifications.mark_read', function(nid) {
			notifications.mark_read(nid, uid);
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

		socket.on('api:topic.loadMore', function(data) {
			var	start = data.after,
				end = start + 10;

			topics.getTopicPosts(data.tid, start, end, uid, function(posts) {
				io.sockets.in('topic_' + data.tid).emit('event:new_post', {
					posts: posts
				});
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
	});
	
}(SocketIO));
