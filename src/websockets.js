console.log('HEY NIB, I STILL GOT CALLED');
'use strict';

var cookie = require('cookie'),




	S = require('string'),




	groups = require('./groups'),
	posts = require('./posts'),
	favourites = require('./favourites'),
	utils = require('../public/src/utils'),

	categories = require('./categories'),
	CategoryTools = require('./categoryTools'),
	notifications = require('./notifications'),
	threadTools = require('./threadTools'),
	postTools = require('./postTools'),
	Messaging = require('./messaging'),
	meta = require('./meta'),


	admin = {
		'categories': require('./admin/categories'),
		'user': require('./admin/user')
	},
	plugins = require('./plugins');

(function(websockets) {

websockets.init = function(io) {

		socket.on('api:get_all_rooms', function(data) {
			socket.emit('api:get_all_rooms', io.sockets.manager.rooms);
		});



		// BEGIN: API calls (todo: organize)



















		socket.on('api:posts.reply', function(data) {
			if (uid < 1 && parseInt(meta.config.allowGuestPosting, 10) === 0) {
				socket.emit('event:alert', {
					title: 'Reply Unsuccessful',
					message: 'You don&apos;t seem to be logged in, so you cannot reply.',
					type: 'danger',
					timeout: 2000
				});
				return;
			}

			if (Date.now() - lastPostTime < meta.config.postDelay * 1000) {
				emitTooManyPostsAlert(socket);
				return;
			}

			topics.reply(data.topic_id, uid, data.content, function(err, postData) {
				if(err) {
					if (err.message === 'content-too-short') {
						emitContentTooShortAlert(socket);
					} else if (err.message === 'too-many-posts') {
						emitTooManyPostsAlert(socket);
					} else if (err.message === 'reply-error') {
						socket.emit('event:alert', {
							title: 'Reply Unsuccessful',
							message: 'Your reply could not be posted at this time. Please try again later.',
							type: 'warning',
							timeout: 2000
						});
					} else if (err.message === 'no-privileges') {
						socket.emit('event:alert', {
							title: 'Unable to post',
							message: 'You do not have posting privileges in this category.',
							type: 'danger',
							timeout: 7500
						});
					}
					return;
				}

				if (postData) {
					lastPostTime = Date.now();
					emitTopicPostStats();

					socket.emit('event:alert', {
						title: 'Reply Successful',
						message: 'You have successfully replied. Click here to view your reply.',
						type: 'success',
						timeout: 2000
					});
					var socketData = {
						posts: [postData]
					};
					io.sockets.in('topic_' + postData.tid).emit('event:new_post', socketData);
					io.sockets.in('recent_posts').emit('event:new_post', socketData);
					io.sockets.in('user/' + postData.uid).emit('event:new_post', socketData);

				}

			});
		});



		socket.on('api:posts.favourite', function(data) {
			favourites.favourite(data.pid, data.room_id, uid, socket);
		});

		socket.on('api:posts.unfavourite', function(data) {
			favourites.unfavourite(data.pid, data.room_id, uid, socket);
		});





		socket.on('api:posts.uploadImage', function(data, callback) {
			posts.uploadPostImage(data, callback);
		});

		socket.on('api:posts.uploadFile', function(data, callback) {
			posts.uploadPostFile(data, callback);
		});

		socket.on('api:posts.getRawPost', function(data, callback) {
			posts.getPostField(data.pid, 'content', function(err, raw) {
				callback({
					post: raw
				});
			});
		});

		socket.on('api:posts.edit', function(data) {
			if(!uid) {
				socket.emit('event:alert', {
					title: 'Can&apos;t edit',
					message: 'Guests can&apos;t edit posts!',
					type: 'warning',
					timeout: 2000
				});
				return;
			} else if (!data.title || data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
				topics.emitTitleTooShortAlert(socket);
				return;
			} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
				emitContentTooShortAlert(socket);
				return;
			}

			postTools.edit(uid, data.pid, data.title, data.content, data.images);
		});

		socket.on('api:posts.delete', function(data, callback) {
			postTools.delete(uid, data.pid, function(err) {

				if(err) {
					return callback(err);
				}

				emitTopicPostStats();

				io.sockets.in('topic_' + data.tid).emit('event:post_deleted', {
					pid: data.pid
				});
				callback(null);
			});
		});

		socket.on('api:posts.restore', function(data, callback) {
			postTools.restore(uid, data.pid, function(err) {
				if(err) {
					return callback(err);
				}

				emitTopicPostStats();

				io.sockets.in('topic_' + data.tid).emit('event:post_restored', {
					pid: data.pid
				});
				callback(null);
			});
		});


		socket.on('api:notifications.mark_read', function(nid) {
			notifications.mark_read(nid, uid);
		});

		socket.on('api:notifications.mark_all_read', function(data, callback) {
			notifications.mark_all_read(uid, function(err) {
				if (!err) {
					callback();
				}
			});
		});



		socket.on('api:chats.get', function(data, callback) {
			var touid = data.touid;
			Messaging.getMessages(uid, touid, function(err, messages) {
				if (err)
					return callback(null);

				callback(messages);
			});
		});

		socket.on('api:chats.send', function(data) {

			var touid = data.touid;
			if (touid === uid || uid === 0) {
				return;
			}

			var msg = S(data.message).stripTags().s;

			user.getMultipleUserFields([uid, touid], ['username'], function(err, usersData) {
				if(err) {
					return;
				}

				var username = usersData[0].username,
					toUsername = usersData[1].username,
					finalMessage = username + ' : ' + msg,
					notifText = 'New message from <strong>' + username + '</strong>';

				if (!isUserOnline(touid)) {
					notifications.create(notifText, 'javascript:app.openChat(&apos;' + username + '&apos;, ' + uid + ');', 'notification_' + uid + '_' + touid, function(nid) {
						notifications.push(nid, [touid], function(success) {

						});
					});
				}

				Messaging.addMessage(uid, touid, msg, function(err, message) {
					var numSockets = 0;

					if (userSockets[touid]) {
						numSockets = userSockets[touid].length;

						for (var x = 0; x < numSockets; ++x) {
							userSockets[touid][x].emit('event:chats.receive', {
								fromuid: uid,
								username: username,
								message: finalMessage,
								timestamp: Date.now()
							});
						}
					}

					if (userSockets[uid]) {

						numSockets = userSockets[uid].length;

						for (var x = 0; x < numSockets; ++x) {
							userSockets[uid][x].emit('event:chats.receive', {
								fromuid: touid,
								username: toUsername,
								message: 'You : ' + msg,
								timestamp: Date.now()
							});
						}
					}
				});
			});
		});

		socket.on('api:chats.list', function(callback) {
			Messaging.getRecentChats(uid, function(err, uids) {
				if (err) {
					winston.warn('[(socket) api:chats.list] Problem retrieving chats: ' + err.message);
				}

				callback(uids || []);
			});
		});

		socket.on('api:config.get', function(data) {
			meta.configs.list(function(err, config) {
				if (!err) socket.emit('api:config.get', config);
			});
		});

		socket.on('api:config.set', function(data) {
			meta.configs.set(data.key, data.value, function(err) {
				if (!err) {
					socket.emit('api:config.set', {
						status: 'ok'
					});

					plugins.fireHook('action:config.set', {
						key: data.key,
						value: data.value
					});
				}

				logger.monitorConfig({io: io}, data);
			});
		});

		socket.on('api:config.remove', function(key) {
			meta.configs.remove(key);
		});

		socket.on('api:composer.push', function(data, callback) {

			if (parseInt(uid, 10) > 0 || parseInt(meta.config.allowGuestPosting, 10) === 1) {
				if (parseInt(data.pid) > 0) {

					async.parallel([
						function(next) {
							posts.getPostFields(data.pid, ['content'], next);
						},
						function(next) {
							topics.getTitleByPid(data.pid, function(title) {
								next(null, title);
							});
						}
					], function(err, results) {
						callback({
							title: results[1],
							pid: data.pid,
							body: results[0].content
						});
					});
				}
			} else {
				callback({
					error: 'no-uid'
				});
			}
		});

		socket.on('api:composer.editCheck', function(pid, callback) {
			posts.getPostField(pid, 'tid', function(err, tid) {
				postTools.isMain(pid, tid, function(err, isMain) {
					callback({
						titleEditable: isMain
					});
				});
			});
		});

		socket.on('api:post.privileges', function(pid) {
			postTools.privileges(pid, uid, function(privileges) {
				privileges.pid = parseInt(pid);
				socket.emit('api:post.privileges', privileges);
			});
		});



		socket.on('api:users.loadMore', function(data, callback) {
			var start = data.after,
				end = start + 19;

			user.getUsers(data.set, start, end, function(err, data) {
				if (err) {
					winston.err(err);
				} else {
					callback({
						users: data
					});
				}
			});
		});

		socket.on('api:admin.topics.getMore', function(data, callback) {
			topics.getAllTopics(data.limit, data.after, function(err, topics) {
				callback(JSON.stringify(topics));
			});
		});

		socket.on('api:admin.categories.create', function(data, callback) {
			categories.create(data, function(err, data) {
				callback(err, data);
			});
		});

		socket.on('api:admin.categories.update', function(data) {
			admin.categories.update(data, socket);
		});

		socket.on('api:admin.user.makeAdmin', function(theirid) {
			if (uid && uid > 0) {
				admin.user.makeAdmin(uid, theirid, socket);
			}
		});

		socket.on('api:admin.user.removeAdmin', function(theirid) {
			if (uid && uid > 0) {
				admin.user.removeAdmin(uid, theirid, socket);
			}
		});

		socket.on('api:admin.user.createUser', function(user, callback) {
			if (uid && uid > 0) {
				admin.user.createUser(uid, user, callback);
			}
		});

		socket.on('api:admin.user.banUser', function(theirid) {
			if (uid && uid > 0) {
				admin.user.banUser(uid, theirid, socket, function(isBanned) {
					if(isBanned) {
						if(userSockets[theirid]) {
							for(var i=0; i<userSockets[theirid].length; ++i) {
								userSockets[theirid][i].emit('event:banned');
							}
						}
						websockets.logoutUser(theirid);
					}
				});
			}
		});

		socket.on('api:admin.user.unbanUser', function(theirid) {
			if (uid && uid > 0) {
				admin.user.unbanUser(uid, theirid, socket);
			}
		});

		socket.on('api:admin.user.search', function(username, callback) {
			if (!(uid && uid > 0)) {
				return callback();
			}

			user.search(username, function(data) {
				function isAdmin(userData, next) {
					user.isAdministrator(userData.uid, function(err, isAdmin) {
						if(err) {
							return next(err);
						}

						userData.administrator = isAdmin?'1':'0';
						next();
					});
				}

				async.each(data, isAdmin, function(err) {
					if(err) {
						return callback({message: err.message});
					}

					callback(null, data);
				});
			});
		});

		socket.on('api:admin.categories.search', function(username, cid, callback) {
			if (uid && uid > 0) {
				user.search(username, function(data) {
					async.map(data, function(userObj, next) {
						CategoryTools.privileges(cid, userObj.uid, function(err, privileges) {
							if (!err) {
								userObj.privileges = privileges;
							} else {
								winston.error('[socket api:admin.categories.search] Could not retrieve permissions');
							}

							next(null, userObj);
						});
					}, function(err, data) {
						if (!callback) socket.emit('api:admin.categories.search', data);
						else callback(null, data);
					});
				});
			} else {
				if (!callback) socket.emit('api:admin.user.search', null);
				else callback();
			}
		});

		socket.on('api:admin.categories.setPrivilege', function(cid, uid, privilege, set, callback) {
			var	cb = function(err) {
				CategoryTools.privileges(cid, uid, callback);
			};

			if (set) {
				groups.joinByGroupName('cid:' + cid + ':privileges:' + privilege, uid, cb);
			} else {
				groups.leaveByGroupName('cid:' + cid + ':privileges:' + privilege, uid, cb);
			}
		});

		socket.on('api:admin.categories.getPrivilegeSettings', function(cid, callback) {
			async.parallel({
				"+r": function(next) {
					groups.getByGroupName('cid:' + cid + ':privileges:+r', { expand: true }, function(err, groupObj) {
						if (!err) {
							next.apply(this, arguments);
						} else {
							next(null, {
								members: []
							});
						}
					});
				},
				"+w": function(next) {
					groups.getByGroupName('cid:' + cid + ':privileges:+w', { expand: true }, function(err, groupObj) {
						if (!err) {
							next.apply(this, arguments);
						} else {
							next(null, {
								members: []
							});
						}
					});
				}
			}, function(err, data) {
				callback(null, {
					"+r": data['+r'].members,
					"+w": data['+w'].members
				});
			});
		});

		socket.on('api:admin.categories.setGroupPrivilege', function(cid, gid, privilege, set, callback) {
			if (set) {
				groups.joinByGroupName('cid:' + cid + ':privileges:' + privilege, gid, callback);
			} else {
				groups.leaveByGroupName('cid:' + cid + ':privileges:' + privilege, gid, callback);
			}
		});

		socket.on('api:admin.categories.groupsList', function(cid, callback) {
			groups.list({expand:false}, function(err, data){
				async.map(data, function(groupObj, next) {
					CategoryTools.groupPrivileges(cid, groupObj.gid, function(err, privileges) {
						if (!err) {
							groupObj.privileges = privileges;
						} else {
							winston.error('[socket api:admin.categories.groupsList] Could not retrieve permissions');
						}

						next(null, groupObj);
					});
				}, function(err, data) {
					callback(null, data);
				});
			});
		});

		socket.on('api:admin.themes.getInstalled', function(callback) {
			meta.themes.get(function(err, themeArr) {
				callback(themeArr);
			});
		});

		socket.on('api:admin.plugins.toggle', function(plugin_id) {
			plugins.toggleActive(plugin_id, function(status) {
				socket.emit('api:admin.plugins.toggle', status);
			});
		});



		/*
			GROUPS
		*/

		socket.on('api:groups.create', function(data, callback) {
			groups.create(data.name, data.description, function(err, groupObj) {
				callback(err ? err.message : null, groupObj || undefined);
			});
		});

		socket.on('api:groups.delete', function(gid, callback) {
			groups.destroy(gid, function(err) {
				callback(err ? err.message : null, err ? null : 'OK');
			});
		});

		socket.on('api:groups.get', function(gid, callback) {
			groups.get(gid, {
				expand: true
			}, function(err, groupObj) {
				callback(err ? err.message : null, groupObj || undefined);
			});
		});

		socket.on('api:groups.join', function(data, callback) {
			groups.join(data.gid, data.uid, callback);
		});

		socket.on('api:groups.leave', function(data, callback) {
			groups.leave(data.gid, data.uid, callback);
		});

		socket.on('api:groups.update', function(data, callback) {
			groups.update(data.gid, data.values, function(err) {
				callback(err ? err.message : null);
			});
		});

		socket.on('api:admin.theme.set', meta.themes.set);

}



})(module.exports);
