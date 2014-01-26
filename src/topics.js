var async = require('async'),
	gravatar = require('gravatar'),
	nconf = require('nconf'),
	validator = require('validator'),
	S = require('string'),
	winston = require('winston'),

	db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	categories = require('./categories'),
	categoryTools = require('./categoryTools'),
	posts = require('./posts'),
	threadTools = require('./threadTools'),
	postTools = require('./postTools'),
	notifications = require('./notifications'),
	feed = require('./feed'),
	favourites = require('./favourites'),
	meta = require('./meta');

(function(Topics) {

	Topics.create = function(uid, title, cid, callback) {
		db.incrObjectField('global', 'nextTid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			db.setAdd('topics:tid', tid);

			var slug = tid + '/' + utils.slugify(title),
				timestamp = Date.now();

			db.setObject('topic:' + tid, {
				'tid': tid,
				'uid': uid,
				'cid': cid,
				'title': title,
				'slug': slug,
				'timestamp': timestamp,
				'lastposttime': 0,
				'postcount': 0,
				'viewcount': 0,
				'locked': 0,
				'deleted': 0,
				'pinned': 0
			}, function(err) {
				if(err) {
					return callback(err);
				}
				db.searchIndex('topic', title, tid);

				user.addTopicIdToUser(uid, tid, timestamp);

				db.sortedSetAdd('categories:' + cid + ':tid', timestamp, tid);
				db.incrObjectField('category:' + cid, 'topic_count');
				db.incrObjectField('global', 'topicCount');

				feed.updateCategory(cid);

				callback(null, tid);
			});
		});
	};

	Topics.post = function(uid, title, content, cid, callback) {
		if (title) {
			title = title.trim();
		}

		if (!title || title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('title-too-short'));
		} else if(title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('title-too-long'));
		}

		if (content) {
			content = content.trim();
		}

		if (!content || content.length < meta.config.miminumPostLength) {
			return callback(new Error('content-too-short'));
		}

		if (!cid) {
			return callback(new Error('invalid-cid'));
		}

		async.waterfall([
			function(next) {
				categoryTools.privileges(cid, uid, next);
			},
			function(privileges, next) {
				if(!privileges.write) {
					return next(new Error('no-privileges'));
				}
				next();
			},
			function(next) {
				user.isReadyToPost(uid, next);
			},
			function(next) {
				Topics.create(uid, title, cid, next);
			},
			function(tid, next) {
				Topics.reply(tid, uid, content, next);
			},
			function(postData, next) {
				threadTools.toggleFollow(postData.tid, uid);
				next(null, postData);
			},
			function(postData, next) {
				Topics.getTopicForCategoryView(postData.tid, uid, function(err, topicData) {
					if(err) {
						return next(err);
					}

					topicData.unreplied = 1;
					next(null, {
						topicData: topicData,
						postData: postData
					});
				});
			}
		], callback);
	};

	Topics.reply = function(tid, uid, content, callback) {
		var privileges;

		async.waterfall([
			function(next) {
				threadTools.privileges(tid, uid, next);
			},
			function(privilegesData, next) {
				privileges = privilegesData;
				if (!privileges.write) {
					return next(new Error('no-privileges'));
				}
				next();
			},
			function(next) {
				user.isReadyToPost(uid, next);
			},
			function(next) {
				if (content) {
					content = content.trim();
				}

				if (!content || content.length < meta.config.minimumPostLength) {
					return next(new Error('content-too-short'));
				}

				posts.create(uid, tid, content, next);
			},
			function(postData, next) {
				db.getObjectField('tid:lastFeedUpdate', tid, function(err, lastFeedUpdate) {
					var now = Date.now();
					if(!lastFeedUpdate || parseInt(lastFeedUpdate, 10) < now - 3600000) {
						feed.updateTopic(tid);
						db.setObjectField('tid:lastFeedUpdate', tid, now);
					}
				});

				feed.updateRecent();
				threadTools.notifyFollowers(tid, uid);
				user.sendPostNotificationToFollowers(uid, tid, postData.pid);

				Topics.markCategoryUnreadForAll(tid, function(err) {
					next(err, postData);
				});
			},
			function(postData, next) {
				Topics.markAsUnreadForAll(tid, function(err) {
					if(err) {
						return next(err);
					}

					Topics.markAsRead(tid, uid, function(err) {
						Topics.pushUnreadCount(null);
						next(err, postData);
					});
				});
			},
			function(postData, next) {
				posts.addUserInfoToPost(postData, next);
			},
			function(postData, next) {
				postData.favourited = false;
				postData.display_moderator_tools = true;
				postData.display_move_tools = privileges.admin || privileges.moderator;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				next(null, postData);
			}
		], callback);
	}

	Topics.createTopicFromPosts = function(uid, title, pids, callback) {
		if(title) {
			title = title.trim();
		}

		if(!title) {
			return callback(new Error('invalid-title'));
		}

		if(!pids || !pids.length) {
			return callback(new Error('invalid-pids'));
		}

		pids.sort();
		var mainPid = pids[0];

		async.parallel({
			postData: function(callback) {
				posts.getPostData(mainPid, callback);
			},
			cid: function(callback) {
				posts.getCidByPid(mainPid, callback);
			}
		}, function(err, results) {
			Topics.create(results.postData.uid, title, results.cid, function(err, tid) {
				if(err) {
					return callback(err);
				}

				async.eachSeries(pids, move, function(err) {
					if(err) {
						return callback(err);
					}

					Topics.getTopicData(tid, callback);
				});

				function move(pid, next) {
					postTools.privileges(pid, uid, function(err, privileges) {
						if(err) {
							return next(err);
						}

						if(privileges.editable) {
							Topics.movePostToTopic(pid, tid, next);
						} else {
							next();
						}
					});
				}
			});
		});
	}

	Topics.movePostToTopic = function(pid, tid, callback) {
		threadTools.exists(tid, function(exists) {
			if(!exists) {
				return callback(new Error('Topic doesn\'t exist'));
			}

			posts.getPostFields(pid, ['tid', 'timestamp'], function(err, postData) {
				if(err) {
					return callback(err);
				}

				if(!postData) {
					return callback(new Error('Post doesn\'t exist'));
				}

				Topics.removePostFromTopic(postData.tid, pid, function(err) {
					if(err) {
						return callback(err);
					}

					Topics.decreasePostCount(postData.tid);

					posts.setPostField(pid, 'tid', tid);

					Topics.increasePostCount(tid);
					Topics.addPostToTopic(tid, pid, postData.timestamp, callback);
				});
			});
		});
	}

	Topics.getTopicData = function(tid, callback) {
		db.getObject('topic:' + tid, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			if(data) {
				data.title = validator.sanitize(data.title).escape();
				data.relativeTime = utils.toISOString(data.timestamp);
			}

			callback(null, data);
		});
	}

	Topics.getTopicDataWithUser = function(tid, callback) {
		Topics.getTopicData(tid, function(err, topic) {
			if(err) {
				return callback(err, null);
			}

			user.getUserFields(topic.uid, ['username', 'userslug', 'picture'] , function(err, userData) {
				if(err) {
					return callback(err, null);
				}

				topic.username = userData.username;
				topic.userslug = userData.userslug
				topic.picture = userData.picture;
				callback(null, topic);
			});
		});
	}

	Topics.getTopicPosts = function(tid, start, end, current_user, callback) {
		posts.getPostsByTid(tid, start, end, function(err, postData) {
			if(err) {
				return callback(err);
			}

			if (Array.isArray(postData) && !postData.length) {
				return callback(null, []);
			}

			for(var i=0; i<postData.length; ++i) {
				postData[i].index = start + i;
			}

			pids = postData.map(function(post) {
				return post.pid;
			});

			function getFavouritesData(next) {
				favourites.getFavouritesByPostIDs(pids, current_user, function(fav_data) {
					next(null, fav_data);
				});
			}

			function addUserInfoToPosts(next) {
				function iterator(post, callback) {
					posts.addUserInfoToPost(post, function() {
						callback(null);
					});
				}

				async.each(postData, iterator, function(err) {
					next(err, null);
				});
			}

			function getPrivileges(next) {
				var privs = {};
				async.each(pids, getPostPrivileges, function(err) {
					next(err, privs);
				});

				function getPostPrivileges(pid, next) {
					postTools.privileges(pid, current_user, function(err, postPrivileges) {
						if(err) {
							return next(err);
						}
						privs[pid] = postPrivileges;
						next();
					});
				}
			}

			async.parallel([getFavouritesData, addUserInfoToPosts, getPrivileges], function(err, results) {
				if(err) {
					return callback(err);
				}

				var fav_data = results[0],
					privileges = results[2];

				for (var i = 0; i < postData.length; ++i) {
					var pid = postData[i].pid;
					postData[i].favourited = fav_data[pid];
					postData[i].display_moderator_tools = (current_user != 0) && privileges[pid].editable;
					postData[i].display_move_tools = privileges[pid].move ? '' : 'hidden';
					if(parseInt(postData[i].deleted, 10) === 1 && !privileges[pid].view_deleted) {
						postData[i].content = 'This post is deleted!';
					}
				}

				callback(null, postData);
			});
		});
	}

	Topics.getPageCount = function(tid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', function(err, postCount) {
			if(err) {
				return callback(err);
			}

			var postsPerPage = parseInt(meta.config.postsPerPage, 10);
			postsPerPage = postsPerPage ? postsPerPage : 20;

			callback(null, Math.ceil(parseInt(postCount, 10) / postsPerPage));
		});
	}

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	}

	Topics.getLatestTopics = function(current_user, start, end, term, callback) {

		var timestamp = Date.now();

		var terms = {
			day: 86400000,
			week: 604800000,
			month: 2592000000
		};

		var since = terms['day'];
		if(terms[term])
			since = terms[term];

		var args = ['topics:recent', '+inf', timestamp - since, 'LIMIT', start, end - start + 1];
		db.getSortedSetRevRangeByScore(args, function(err, tids) {
			if (err) {
				return callback(err);
			}

			var latestTopics = {
				'no_topics_message': 'hidden',
				'topics': []
			};

			if (!tids || !tids.length) {
				latestTopics.no_topics_message = 'show';
				callback(err, latestTopics);
				return;
			}

			// Filter out topics that belong to categories that this user cannot access
			async.filter(tids, function(tid, next) {
				threadTools.privileges(tid, current_user, function(err, privileges) {
					if (!err && privileges.read) {
						next(true);
					} else {
						next(false);
					}
				});
			}, function(tids) {
				Topics.getTopicsByTids(tids, 0, current_user, function(err, topicData) {
					latestTopics.topics = topicData;
					callback(err, latestTopics);
				});
			});
		});
	}

	Topics.getTotalUnread = function(uid, callback) {

		var unreadTids = [],
			start = 0,
			stop = 21,
			done = false;

		async.whilst(
			function() {
				return unreadTids.length < 21 && !done;
			},
			function(callback) {
				db.getSortedSetRevRange('topics:recent', start, stop, function(err, tids) {

					if (err) {
						return callback(err);
					}

					if (tids && !tids.length) {
						done = true;
						return callback(null);
					}

					Topics.hasReadTopics(tids, uid, function(read) {

						var newtids = tids.filter(function(tid, index, self) {
							return read[index] === 0;
						});

						unreadTids.push.apply(unreadTids, newtids);

						start = stop + 1;
						stop = start + 21;
						callback(null);
					});
				});
			},
			function(err) {
				callback(null, {
					count: unreadTids.length
				});
			}
		);
	};

	Topics.getUnreadTids = function(uid, start, stop, callback) {
		var unreadTids = [],
			done = false;

		function continueCondition() {
			return unreadTids.length < 20 && !done;
		}

		async.whilst(continueCondition, function(callback) {
			db.getSortedSetRevRange('topics:recent', start, stop, function(err, tids) {
				if (err) {
					return callback(err);
				}

				if (tids && !tids.length) {
					done = true;
					return callback(null);
				}

				if (uid === 0) {
					unreadTids.push.apply(unreadTids, tids);
					callback(null);
				} else {
					Topics.hasReadTopics(tids, uid, function(read) {

						var newtids = tids.filter(function(tid, index, self) {
							return parseInt(read[index], 10) === 0;
						});

						// Filter out topics that belong to categories that this user cannot access
						async.filter(newtids, function(tid, next) {
							threadTools.privileges(tid, uid, function(err, privileges) {
								if (!err && privileges.read) {
									next(true);
								} else {
									next(false);
								}
							});
						}, function(newtids) {
							unreadTids.push.apply(unreadTids, newtids);

							if(continueCondition()) {
								start = stop + 1;
								stop = start + 19;
							}

							callback(null);
						});
					});
				}
			});
		}, function(err) {
			callback(err, unreadTids);
		});
	};

	Topics.getUnreadTopics = function(uid, start, stop, callback) {
		var unreadTopics = {
			'category_name': 'Unread',
			'show_sidebar': 'hidden',
			'show_topic_button': 'hidden',
			'show_markallread_button': 'show',
			'no_topics_message': 'hidden',
			'topics': []
		};

		function noUnreadTopics() {
			unreadTopics.no_topics_message = 'show';
			unreadTopics.show_markallread_button = 'hidden';
			callback(null, unreadTopics);
		}

		function sendUnreadTopics(topicIds) {

			Topics.getTopicsByTids(topicIds, 0, uid, function(err, topicData) {
				if(err) {
					return callback(err);
				}

				unreadTopics.topics = topicData;
				unreadTopics.nextStart = stop + 1;
				if (!topicData || topicData.length === 0) {
					unreadTopics.no_topics_message = 'show';
				}
				if (uid === 0 || topicData.length === 0) {
					unreadTopics.show_markallread_button = 'hidden';
				}

				callback(null, unreadTopics);
			});
		}

		Topics.getUnreadTids(uid, start, stop, function(err, unreadTids) {
			if (err) {
				return callback(err);
			}

			if (unreadTids.length) {
				sendUnreadTopics(unreadTids);
			} else {
				noUnreadTopics();
			}
		});
	};

	Topics.pushUnreadCount = function(uids, callback) {
		var	websockets = require('./socket.io');

		if (!uids) {
			clients = websockets.getConnectedClients();
			uids = Object.keys(clients);
		} else if (!Array.isArray(uids)) {
			uids = [uids];
		}

		uids = uids.filter(function(value) {
			return parseInt(value, 10) !== 0;
		});

		async.each(uids, function(uid, next) {
			Topics.getUnreadTids(uid, 0, 19, function(err, tids) {
				websockets.in('uid_' + uid).emit('event:unread.updateCount', null, tids);
				next();
			});
		}, function(err) {
			if (err) {
				winston.error(err.message);
			}

			if (callback) {
				callback();
			}
		});
	};

	Topics.getTopicsByTids = function(tids, cid, current_user, callback) {

		var retrieved_topics = [];

		if (!Array.isArray(tids) || tids.length === 0) {
			return callback(null, retrieved_topics);
		}

		function getTopicInfo(topicData, callback) {

			function getUserInfo(next) {
				user.getUserFields(topicData.uid, ['username', 'userslug', 'picture'], next);
			}

			function hasReadTopic(next) {
				Topics.hasReadTopic(topicData.tid, current_user, function(hasRead) {
					next(null, hasRead);
				});
			}

			function getTeaserInfo(next) {
				Topics.getTeaser(topicData.tid, function(err, teaser) {
					next(null, teaser || {});
				});
			}

			// temporary. I don't think this call should belong here

			function getPrivileges(next) {
				categoryTools.privileges(cid, current_user, next);
			}

			function getCategoryInfo(next) {
				categories.getCategoryFields(topicData.cid, ['name', 'slug', 'icon'], next);
			}

			async.parallel([getUserInfo, hasReadTopic, getTeaserInfo, getPrivileges, getCategoryInfo], function(err, results) {
				if(err) {
					return callback(err);
				}

				callback(null, {
					username: results[0].username,
					userslug: results[0].userslug,
					picture: results[0].picture,
					userbanned: results[0].banned,
					hasread: results[1],
					teaserInfo: results[2],
					privileges: results[3],
					categoryData: results[4]
				});
			});
		}

		function isTopicVisible(topicData, topicInfo) {
			var deleted = parseInt(topicData.deleted, 10) !== 0;
			return !deleted || (deleted && topicInfo.privileges.view_deleted) || topicData.uid === current_user;
		}

		function loadTopic(tid, next) {
			Topics.getTopicData(tid, function(err, topicData) {
				if(err) {
					return next(err);
				}

				if (!topicData) {
					return next();
				}

				getTopicInfo(topicData, function(err, topicInfo) {
					if(err) {
						return next(err);
					}

					topicData['pin-icon'] = parseInt(topicData.pinned, 10) === 1 ? 'fa-thumb-tack' : 'none';
					topicData['lock-icon'] = parseInt(topicData.locked, 10) === 1 ? 'fa-lock' : 'none';
					topicData['deleted-class'] = parseInt(topicData.deleted, 10) === 1 ? 'deleted' : '';

					topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
					topicData.username = topicInfo.username || 'anonymous';
					topicData.userslug = topicInfo.userslug || '';
					topicData.picture = topicInfo.picture || gravatar.url('', {}, true);
					topicData.categoryIcon = topicInfo.categoryData.icon;
					topicData.categoryName = topicInfo.categoryData.name;
					topicData.categorySlug = topicInfo.categoryData.slug;
					topicData.badgeclass = (topicInfo.hasread && parseInt(current_user, 10) !== 0) ? '' : 'badge-important';
					topicData.teaser_username = topicInfo.teaserInfo.username || '';
					topicData.teaser_userslug = topicInfo.teaserInfo.userslug || '';
					topicData.teaser_userpicture = topicInfo.teaserInfo.picture || gravatar.url('', {}, true);
					topicData.teaser_pid = topicInfo.teaserInfo.pid;
					topicData.teaser_timestamp = utils.toISOString(topicInfo.teaserInfo.timestamp);

					if (isTopicVisible(topicData, topicInfo)) {
						retrieved_topics.push(topicData);
					}

					next(null);
				});
			});
		}

		async.eachSeries(tids, loadTopic, function(err) {
			callback(err, retrieved_topics);
		});

	}

	Topics.getTopicWithPosts = function(tid, current_user, start, end, quiet, callback) {
		threadTools.exists(tid, function(exists) {
			if (!exists) {
				return callback(new Error('Topic tid \'' + tid + '\' not found'));
			}

			// "quiet" is used for things like RSS feed updating, HTML parsing for non-js users, etc
			if (!quiet) {
				Topics.markAsRead(tid, current_user, function(err) {
					Topics.pushUnreadCount(current_user);
				});
				Topics.increaseViewCount(tid);
			}

			function getTopicData(next) {
				Topics.getTopicData(tid, next);
			}

			function getTopicPosts(next) {
				Topics.getTopicPosts(tid, start, end, current_user, next);
			}

			function getPrivileges(next) {
				threadTools.privileges(tid, current_user, next);
			}

			function getCategoryData(next) {
				Topics.getCategoryData(tid, next);
			}

			function getPageCount(next) {
				Topics.getPageCount(tid, next);
			}

			async.parallel([getTopicData, getTopicPosts, getPrivileges, getCategoryData, getPageCount], function(err, results) {
				if (err) {
					winston.error('[Topics.getTopicWithPosts] Could not retrieve topic data: ', err.message);
					return callback(err, null);
				}

				var topicData = results[0],
					topicPosts = results[1],
					privileges = results[2],
					categoryData = results[3],
					pageCount = results[4];

				var postsPerPage = parseInt(meta.config.postsPerPage, 10);
				postsPerPage = postsPerPage ? postsPerPage : 20;

				callback(null, {
					'topic_name': topicData.title,
					'category_name': categoryData.name,
					'category_slug': categoryData.slug,
					'locked': topicData.locked,
					'deleted': topicData.deleted,
					'pinned': topicData.pinned,
					'timestamp': topicData.timestamp,
					'slug': topicData.slug,
					'postcount': topicData.postcount,
					'viewcount': topicData.viewcount,
					'pageCount': pageCount,
					'unreplied': parseInt(topicData.postcount, 10) > 1,
					'topic_id': tid,
					'expose_tools': privileges.editable ? 1 : 0,
					'disableSocialButtons': meta.config.disableSocialButtons !== undefined ? parseInt(meta.config.disableSocialButtons, 10) !== 0 : false,
					'posts': topicPosts
				});
			});
		});
	}


	Topics.getTopicForCategoryView = function(tid, uid, callback) {

		function getTopicData(next) {
			Topics.getTopicDataWithUser(tid, next);
		}

		function getReadStatus(next) {
			if (uid && parseInt(uid, 10) > 0) {
				Topics.hasReadTopic(tid, uid, function(read) {
					next(null, read);
				});
			} else {
				next(null, null);
			}
		}

		function getTeaser(next) {
			Topics.getTeaser(tid, next);
		}

		async.parallel([getTopicData, getReadStatus, getTeaser], function(err, results) {
			if (err) {
				return callback(err);
			}

			var topicData = results[0],
				hasRead = results[1],
				teaser = results[2];

			topicData['pin-icon'] = parseInt(topicData.pinned, 10) === 1 ? 'fa-thumb-tack' : 'none';
			topicData['lock-icon'] = parseInt(topicData.locked, 10) === 1 ? 'fa-lock' : 'none';

			topicData.badgeclass = hasRead ? '' : 'badge-important';
			topicData.teaser_username = teaser.username || '';
			topicData.teaser_userslug = teaser.userslug || '';
			topicData.userslug = teaser.userslug || '';
			topicData.teaser_timestamp = utils.toISOString(teaser.timestamp);
			topicData.teaser_userpicture = teaser.picture;

			callback(null, topicData);
		});
	}

	Topics.getAllTopics = function(limit, after, callback) {
		db.getSetMembers('topics:tid', function(err, tids) {
			if(err) {
				return callback(err, null);
			}

			var topics = [],
				numTids, x;

			// Sort into ascending order
			tids.sort(function(a, b) {
				return a - b;
			});

			// Eliminate everything after the "after" tid
			if (after) {
				for (x = 0, numTids = tids.length; x < numTids; x++) {
					if (tids[x] >= after) {
						tids = tids.slice(0, x);
						break;
					}
				}
			}

			if (limit) {
				if (limit > 0 && limit < tids.length) {
					tids = tids.slice(tids.length - limit);
				}
			}

			// Sort into descending order
			tids.sort(function(a, b) {
				return b - a;
			});

			async.each(tids, function(tid, next) {
				Topics.getTopicDataWithUser(tid, function(err, topicData) {
					topics.push(topicData);
					next();
				});
			}, function(err) {
				callback(err, topics);
			});
		});
	}

	Topics.markAllRead = function(uid, callback) {
		db.getSetMembers('topics:tid', function(err, tids) {
			if (err) {
				return callback(err);
			}

			if(!tids || !tids.length) {
				return callback(null);
			}

			function markRead(tid, next) {
				Topics.markAsRead(tid, uid, next);
			}

			async.each(tids, markRead, callback);
		});
	}

	Topics.getTitleByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicField(tid, 'title', function(err, title) {
				callback(title);
			});
		});
	}

	Topics.markAsUnreadForAll = function(tid, callback) {
		db.delete('tid:' + tid + ':read_by_uid', callback);
	}

	Topics.markAsRead = function(tid, uid, callback) {

		db.setAdd('tid:' + tid + ':read_by_uid', uid, function(err) {
			if(callback) {
				callback(err);
			}
		});

		Topics.getTopicField(tid, 'cid', function(err, cid) {

			categories.isTopicsRead(cid, uid, function(read) {
				if (read) {
					categories.markAsRead(cid, uid);
				}
			});
		});

		user.notifications.getUnreadByUniqueId(uid, 'topic:' + tid, function(err, nids) {
			notifications.mark_read_multiple(nids, uid, function() {
				user.pushNotifCount(uid);
			});
		});
	}

	Topics.markCategoryUnreadForAll = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			categories.markAsUnreadForAll(cid, callback);
		});
	}

	Topics.hasReadTopics = function(tids, uid, callback) {
		var sets = [];

		for (var i = 0, ii = tids.length; i < ii; i++) {
			sets.push('tid:' + tids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, function(err, hasRead) {
			callback(hasRead);
		});
	}

	Topics.hasReadTopic = function(tid, uid, callback) {
		db.isSetMember('tid:' + tid + ':read_by_uid', uid, function(err, hasRead) {

			if (err === null) {
				callback(hasRead);
			} else {
				console.log(err);
				callback(false);
			}
		});
	}

	Topics.getTeasers = function(tids, callback) {
		var teasers = [];
		if (Array.isArray(tids)) {
			async.eachSeries(tids, function(tid, next) {
				Topics.getTeaser(tid, function(err, teaser_info) {
					if (err) {
						teaser_info = {};
					}
					teasers.push(teaser_info);
					next();
				});
			}, function() {
				callback(teasers);
			});
		} else callback(teasers);
	}

	Topics.getTeaser = function(tid, callback) {
		threadTools.getLatestUndeletedPid(tid, function(err, pid) {
			if (err) {
				return callback(err, null);
			}

			posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function(err, postData) {
				if (err) {
					return callback(err, null);
				} else if(!postData) {
					return callback(new Error('no-teaser-found'));
				}

				user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function(err, userData) {
					if (err) {
						return callback(err, null);
					}

					callback(null, {
						pid: postData.pid,
						username: userData.username || 'anonymous',
						userslug: userData.userslug,
						picture: userData.picture || gravatar.url('', {}, true),
						timestamp: postData.timestamp
					});
				});
			});
		});
	}

	Topics.getTopicField = function(tid, field, callback) {
		db.getObjectField('topic:' + tid, field, callback);
	}

	Topics.getTopicFields = function(tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, callback);
	}

	Topics.setTopicField = function(tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	}

	Topics.increasePostCount = function(tid, callback) {
		db.incrObjectField('topic:' + tid, 'postcount', callback);
	}

	Topics.decreasePostCount = function(tid, callback) {
		db.decrObjectField('topic:' + tid, 'postcount', callback);
	}

	Topics.increaseViewCount = function(tid, callback) {
		db.incrObjectField('topic:' + tid, 'viewcount', callback);
	}

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(err, locked) {
			if(err) {
				return callback(err, null);
			}
			callback(null, parseInt(locked, 10) === 1);
		});
	}

	Topics.updateTimestamp = function(tid, timestamp) {
		db.sortedSetAdd('topics:recent', timestamp, tid);
		Topics.setTopicField(tid, 'lastposttime', timestamp);
	}

	Topics.onNewPostMade = function(tid, pid, timestamp, callback) {
		Topics.increasePostCount(tid);
		Topics.updateTimestamp(tid, timestamp);
		Topics.addPostToTopic(tid, pid, timestamp, callback);
	}

	Topics.addPostToTopic = function(tid, pid, timestamp, callback) {
		db.sortedSetAdd('tid:' + tid + ':posts', timestamp, pid, callback);
	}

	Topics.removePostFromTopic = function(tid, pid, callback) {
		db.sortedSetRemove('tid:' + tid + ':posts', pid, callback);
	}

	Topics.getPids = function(tid, callback) {
		db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, callback);
	}

	Topics.getUids = function(tid, callback) {
		var uids = {};
		Topics.getPids(tid, function(err, pids) {

			function getUid(pid, next) {
				posts.getPostField(pid, 'uid', function(err, uid) {
					if (err)
						return next(err);
					uids[uid] = 1;
					next(null);
				});
			}

			async.each(pids, getUid, function(err) {
				if (err)
					return callback(err, null);

				callback(null, Object.keys(uids));
			});
		});
	}

	Topics.delete = function(tid) {
		Topics.setTopicField(tid, 'deleted', 1);
		db.sortedSetRemove('topics:recent', tid);

		Topics.getTopicField(tid, 'cid', function(err, cid) {
			feed.updateCategory(cid);
			db.incrObjectFieldBy('category:' + cid, 'topic_count', -1);
		});
	}

	Topics.restore = function(tid) {
		Topics.setTopicField(tid, 'deleted', 0);
		Topics.getTopicField(tid, 'lastposttime', function(err, lastposttime) {
			db.sortedSetAdd('topics:recent', lastposttime, tid);
		});

		Topics.getTopicField(tid, 'cid', function(err, cid) {
			feed.updateCategory(cid);
			db.incrObjectFieldBy('category:' + cid, 'topic_count', 1);
		});
	}

	Topics.reIndexTopic = function(tid, callback) {
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				return callback(err);
			}

			posts.reIndexPids(pids, callback);
		});
	}

	Topics.reIndexAll = function(callback) {
		db.getSetMembers('topics:tid', function(err, tids) {
			if (err) {
				return callback(err);
			}

			async.each(tids, Topics.reIndexTopic, callback);
		});
	}

}(exports));