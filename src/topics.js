var RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	categories = require('./categories.js'),
	posts = require('./posts.js'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools'),
	notifications = require('./notifications'),
	async = require('async'),
	feed = require('./feed.js'),
	favourites = require('./favourites.js'),
	meta = require('./meta.js'),
	reds = require('reds'),
	topicSearch = reds.createSearch('nodebbtopicsearch'),
	nconf = require('nconf'),
	validator = require('validator');

(function(Topics) {

	Topics.post = function(uid, title, content, category_id, callback) {
		if (!category_id)
			throw new Error('Attempted to post without a category_id');

		if (content)
			content = content.trim();
		if (title)
			title = title.trim();

		if (!uid) {
			callback(new Error('not-logged-in'), null);
			return;
		} else if (!title || title.length < meta.config.minimumTitleLength) {
			callback(new Error('title-too-short'), null);
			return;
		} else if (!content || content.length < meta.config.miminumPostLength) {
			callback(new Error('content-too-short'), null);
			return;
		}

		user.getUserField(uid, 'lastposttime', function(err, lastposttime) {
			if (err) lastposttime = 0;
			if (Date.now() - lastposttime < meta.config.postDelay * 1000) {
				callback(new Error('too-many-posts'), null);
				return;
			}

			RDB.incr('next_topic_id', function(err, tid) {
				RDB.handle(err);

				// Global Topics
				if (uid == null) uid = 0;
				if (uid !== null) {
					RDB.sadd('topics:tid', tid);
				} else {
					// need to add some unique key sent by client so we can update this with the real uid later
					RDB.lpush('topics:queued:tid', tid);
				}

				var slug = tid + '/' + utils.slugify(title);
				var timestamp = Date.now();
				RDB.hmset('topic:' + tid, {
					'tid': tid,
					'uid': uid,
					'cid': category_id,
					'title': title,
					'slug': slug,
					'timestamp': timestamp,
					'lastposttime': 0,
					'postcount': 0,
					'viewcount': 0,
					'locked': 0,
					'deleted': 0,
					'pinned': 0
				});

				topicSearch.index(title, tid);

				user.addTopicIdToUser(uid, tid);

				// let everyone know that there is an unread topic in this category
				RDB.del('cid:' + category_id + ':read_by_uid', function(err, data) {
					Topics.markAsRead(tid, uid);
				});


				// in future it may be possible to add topics to several categories, so leaving the door open here.
				RDB.zadd('categories:' + category_id + ':tid', timestamp, tid);
				RDB.hincrby('category:' + category_id, 'topic_count', 1);
				RDB.incr('totaltopiccount');

				feed.updateCategory(category_id);

				posts.create(uid, tid, content, function(err, postData) {
					if(err) {
						return callback(err, null);
					} else if(!postData) {
						return callback(new Error('invalid-post'), null);
					}

					// Auto-subscribe the post creator to the newly created topic
					threadTools.toggleFollow(tid, uid);

					Topics.getTopicForCategoryView(tid, uid, function(topicData) {
						topicData.unreplied = 1;

						callback(null, {
							topicData: topicData,
							postData: postData
						});
					});
				});
			});
		});
	};

	Topics.getTopicData = function(tid, callback) {
		RDB.hgetall('topic:' + tid, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			if(data) {
				data.title = validator.sanitize(data.title).escape();
				if(data.timestamp) {
					data.relativeTime = new Date(parseInt(data.timestamp, 10)).toISOString();
				}
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
		posts.getPostsByTid(tid, start, end, function(postData) {
			if (Array.isArray(postData) && !postData.length)
				return callback([]);

			function getFavouritesData(next) {
				var pids = [];
				for (var i = 0; i < postData.length; ++i)
					pids.push(postData[i].pid);

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
				postTools.privileges(tid, current_user, function(privData) {
					next(null, privData);
				});
			}

			async.parallel([getFavouritesData, addUserInfoToPosts, getPrivileges], function(err, results) {
				var fav_data = results[0],
					privileges = results[2];

				for (var i = 0; i < postData.length; ++i) {
					postData[i].fav_button_class = fav_data[postData[i].pid] ? 'btn-warning' : '';
					postData[i].fav_star_class = fav_data[postData[i].pid] ? 'fa-star' : 'fa-star-o';
					postData[i]['display_moderator_tools'] = ((current_user != 0) && (postData[i].uid == current_user || privileges.editable)) ? 'show' : 'none';

					postData[i].show_banned = postData[i].user_banned === '1' ? 'show' : 'hide';
				}

				callback(postData);
			});
		});
	}

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
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

		RDB.zrevrangebyscore(args, function(err, tids) {
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

			Topics.getTopicsByTids(tids, current_user, function(topicData) {
				latestTopics.topics = topicData;
				callback(err, latestTopics);
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
				RDB.zrevrange('topics:recent', start, stop, function(err, tids) {

					if (err)
						return callback(err);

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
				callback({
					count: unreadTids.length
				});
			}
		);
	};

	Topics.getUnreadTopics = function(uid, start, stop, callback) {

		var unreadTopics = {
			'category_name': 'Unread',
			'show_sidebar': 'hidden',
			'show_topic_button': 'hidden',
			'show_markallread_button': 'show',
			'no_topics_message': 'hidden',
			'topic_row_size': 'col-md-12',
			'topics': []
		};

		function noUnreadTopics() {
			unreadTopics.no_topics_message = 'show';
			unreadTopics.show_markallread_button = 'hidden';
			callback(unreadTopics);
		}

		function sendUnreadTopics(topicIds) {
			Topics.getTopicsByTids(topicIds, uid, function(topicData) {
				unreadTopics.topics = topicData;
				unreadTopics.nextStart = start + topicIds.length;
				if (!topicData || topicData.length === 0)
					unreadTopics.no_topics_message = 'show';
				if (uid === 0 || topicData.length === 0)
					unreadTopics.show_markallread_button = 'hidden';
				callback(unreadTopics);
			});
		}

		var unreadTids = [],
			done = false;

		function continueCondition() {
			return unreadTids.length < 20 && !done;
		}

		async.whilst(
			continueCondition,
			function(callback) {
				RDB.zrevrange('topics:recent', start, stop, function(err, tids) {
					if (err)
						return callback(err);

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

							unreadTids.push.apply(unreadTids, newtids);

							if(continueCondition()) {
								start = stop + 1;
								stop = start + 19;
							}

							callback(null);
						});
					}
				});
			},
			function(err) {
				if (err)
					return callback([]);
				if (unreadTids.length)
					sendUnreadTopics(unreadTids);
				else
					noUnreadTopics();

			}
		);
	}

	Topics.getTopicsByTids = function(tids, current_user, callback, category_id) {

		var retrieved_topics = [];

		if (!Array.isArray(tids) || tids.length === 0) {
			callback(retrieved_topics);
			return;
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
				categories.privileges(category_id, current_user, function(user_privs) {
					next(null, user_privs);
				});
			}

			function getCategoryInfo(next) {
				categories.getCategoryFields(topicData.cid, ['name', 'slug', 'icon'], function(err, categoryData) {
					next(err, categoryData);
				});
			}

			async.parallel([getUserInfo, hasReadTopic, getTeaserInfo, getPrivileges, getCategoryInfo], function(err, results) {
				callback({
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

		function loadTopic(tid, callback) {
			Topics.getTopicData(tid, function(err, topicData) {
				if (!topicData) {
					return callback(null);
				}

				getTopicInfo(topicData, function(topicInfo) {

					topicData['pin-icon'] = topicData.pinned === '1' ? 'fa-thumb-tack' : 'none';
					topicData['lock-icon'] = topicData.locked === '1' ? 'fa-lock' : 'none';
					topicData['deleted-class'] = topicData.deleted === '1' ? 'deleted' : '';

					topicData.unreplied = topicData.postcount === '1';
					topicData.username = topicInfo.username;
					topicData.userslug = topicInfo.userslug;
					topicData.picture = topicInfo.picture;
					topicData.categoryIcon = topicInfo.categoryData.icon;
					topicData.categoryName = topicInfo.categoryData.name;
					topicData.categorySlug = topicInfo.categoryData.slug;
					topicData.badgeclass = (topicInfo.hasread && current_user != 0) ? '' : 'badge-important';
					topicData.teaser_text = topicInfo.teaserInfo.text || '',
					topicData.teaser_username = topicInfo.teaserInfo.username || '';
					topicData.teaser_userslug = topicInfo.teaserInfo.userslug || '';
					topicData.teaser_userpicture = topicInfo.teaserInfo.picture || require('gravatar').url('', {}, https = nconf.get('https'));
					topicData.teaser_pid = topicInfo.teaserInfo.pid;
					topicData.teaser_timestamp = topicInfo.teaserInfo.timestamp ? (new Date(parseInt(topicInfo.teaserInfo.timestamp, 10)).toISOString()) : '';

					if (isTopicVisible(topicData, topicInfo))
						retrieved_topics.push(topicData);

					callback(null);
				});
			});
		}

		async.eachSeries(tids, loadTopic, function(err) {
			if (!err) {
				callback(retrieved_topics);
			}
		});

	}

	Topics.getTopicWithPosts = function(tid, current_user, start, end, callback) {
		threadTools.exists(tid, function(exists) {
			if (!exists)
				return callback(new Error('Topic tid \'' + tid + '\' not found'));

			Topics.markAsRead(tid, current_user);
			Topics.increaseViewCount(tid);

			function getTopicData(next) {
				Topics.getTopicData(tid, next);
			}

			function getTopicPosts(next) {
				Topics.getTopicPosts(tid, start, end, current_user, function(topicPosts, privileges) {
					next(null, topicPosts);
				});
			}

			function getPrivileges(next) {
				threadTools.privileges(tid, current_user, function(privData) {
					next(null, privData);
				});
			}

			function getCategoryData(next) {
				Topics.getCategoryData(tid, next);
			}

			async.parallel([getTopicData, getTopicPosts, getPrivileges, getCategoryData], function(err, results) {
				if (err) {
					console.log(err.message);
					callback(err, null);
					return;
				}

				var topicData = results[0],
					topicPosts = results[1],
					privileges = results[2],
					categoryData = results[3];

				callback(null, {
					'topic_name': topicData.title,
					'category_name': categoryData.name,
					'category_slug': categoryData.slug,
					'locked': topicData.locked,
					'deleted': topicData.deleted,
					'pinned': topicData.pinned,
					'slug': topicData.slug,
					'postcount': topicData.postcount,
					'viewcount': topicData.viewcount,
					'unreplied': topicData.postcount > 1,
					'topic_id': tid,
					'expose_tools': privileges.editable ? 1 : 0,
					'posts': topicPosts,
					'twitter-intent-url': 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(nconf.get('url') + 'topic/' + topicData.slug) + '&text=' + encodeURIComponent(topicData.title),
					'facebook-share-url': 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(nconf.get('url') + 'topic/' + topicData.slug),
					'google-share-url': 'https://plus.google.com/share?url=' + encodeURIComponent(nconf.get('url') + 'topic/' + topicData.slug)
				});
			});
		});
	}


	Topics.getTopicForCategoryView = function(tid, uid, callback) {

		function getTopicData(next) {
			Topics.getTopicDataWithUser(tid, next);
		}

		function getReadStatus(next) {
			if (uid && parseInt(uid) > 0) {
				Topics.hasReadTopic(tid, uid, function(read) {
					next(null, read);
				});
			} else {
				next(null, null);
			}
		}

		function getTeaser(next) {
			Topics.getTeaser(tid, function(err, teaser) {
				if (err) teaser = {};
				next(null, teaser);
			});
		}

		async.parallel([getTopicData, getReadStatus, getTeaser], function(err, results) {
			if (err) {
				throw new Error(err);
			}

			var topicData = results[0],
				hasRead = results[1],
				teaser = results[2];

			topicData['pin-icon'] = topicData.pinned === '1' ? 'fa-thumb-tack' : 'none';
			topicData['lock-icon'] = topicData.locked === '1' ? 'fa-lock' : 'none';

			topicData.badgeclass = hasRead ? '' : 'badge-important';
			topicData.teaser_text = teaser.text || '';
			topicData.teaser_username = teaser.username || '';
			topicData.teaser_userslug = teaser.userslug || '';
			topicData.userslug = teaser.userslug || '';
			topicData.teaser_timestamp = teaser.timestamp ? (new Date(parseInt(teaser.timestamp,10)).toISOString()) : '';
			topicData.teaser_userpicture = teaser.picture;

			callback(topicData);
		});
	}

	Topics.getAllTopics = function(limit, after, callback) {
		RDB.smembers('topics:tid', function(err, tids) {
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
		RDB.smembers('topics:tid', function(err, tids) {
			if (err) {
				console.log(err);
				callback(err, null);
				return;
			}

			if (tids && tids.length) {
				for (var i = 0; i < tids.length; ++i) {
					Topics.markAsRead(tids[i], uid);
				}
			}

			callback(null, true);
		});
	}

	Topics.getTitleByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicField(tid, 'title', function(err, title) {
				callback(title);
			});
		});
	}

	Topics.markUnRead = function(tid, callback) {
		RDB.del('tid:' + tid + ':read_by_uid', callback);
	}

	Topics.markAsRead = function(tid, uid) {

		RDB.sadd('tid:' + tid + ':read_by_uid', uid);

		Topics.getTopicField(tid, 'cid', function(err, cid) {

			categories.isTopicsRead(cid, uid, function(read) {
				if (read) {
					categories.markAsRead(cid, uid);
				}
			});
		});

		user.notifications.getUnreadByUniqueId(uid, 'topic:' + tid, function(err, nids) {
			notifications.mark_read_multiple(nids, uid, function() {

			});
		});
	}

	Topics.hasReadTopics = function(tids, uid, callback) {
		var batch = RDB.multi();

		for (var i = 0, ii = tids.length; i < ii; i++) {
			batch.sismember('tid:' + tids[i] + ':read_by_uid', uid);
		}

		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	}

	Topics.hasReadTopic = function(tid, uid, callback) {
		RDB.sismember('tid:' + tid + ':read_by_uid', uid, function(err, hasRead) {

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
					if (err) teaser_info = {};
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

			posts.getPostFields(pid, ['pid', 'content', 'uid', 'timestamp'], function(err, postData) {
				if (err) {
					return callback(err, null);
				} else if(!postData) {
					return callback(new Error('no-teaser-found'));
				}

				user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function(err, userData) {
					if (err) {
						return callback(err, null);
					}

					var stripped = postData.content,
						timestamp = postData.timestamp,
						returnObj = {
							"pid": postData.pid,
							"username": userData.username,
							"userslug": userData.userslug,
							"picture": userData.picture,
							"timestamp": timestamp
						};

					if (postData.content) {
						stripped = postData.content.replace(/>.+\n\n/, '');
						postTools.parse(stripped, function(err, stripped) {
							returnObj.text = utils.strip_tags(stripped);
							callback(null, returnObj);
						});
					} else {
						returnObj.text = '';
						callback(null, returnObj);
					}
				});
			});
		});
	}

	Topics.emitTitleTooShortAlert = function(socket) {
		socket.emit('event:alert', {
			type: 'danger',
			timeout: 2000,
			title: 'Title too short',
			message: "Please enter a longer title. At least " + meta.config.minimumTitleLength + " characters.",
			alert_id: 'post_error'
		});
	}

	Topics.getTopicField = function(tid, field, callback) {
		RDB.hget('topic:' + tid, field, callback);
	}

	Topics.getTopicFields = function(tid, fields, callback) {
		RDB.hmgetObject('topic:' + tid, fields, callback);
	}

	Topics.setTopicField = function(tid, field, value, callback) {
		RDB.hset('topic:' + tid, field, value, callback);
	}

	Topics.increasePostCount = function(tid, callback) {
		RDB.hincrby('topic:' + tid, 'postcount', 1, callback);
	}

	Topics.increaseViewCount = function(tid, callback) {
		RDB.hincrby('topic:' + tid, 'viewcount', 1, callback);
	}

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(err, locked) {
			if(err) {
				return callback(err, null);
			}
			callback(null, locked === "1");
		});
	}

	Topics.updateTimestamp = function(tid, timestamp) {
		RDB.zadd('topics:recent', timestamp, tid);
		Topics.setTopicField(tid, 'lastposttime', timestamp);
	}

	Topics.addPostToTopic = function(tid, pid) {
		RDB.rpush('tid:' + tid + ':posts', pid);
	}

	Topics.getPids = function(tid, callback) {
		RDB.lrange('tid:' + tid + ':posts', 0, -1, callback);
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
		RDB.zrem('topics:recent', tid);

		Topics.getTopicField(tid, 'cid', function(err, cid) {
			feed.updateCategory(cid);
			RDB.hincrby('category:' + cid, 'topic_count', -1);
		});
	}

	Topics.restore = function(tid) {
		Topics.setTopicField(tid, 'deleted', 0);
		Topics.getTopicField(tid, 'lastposttime', function(err, lastposttime) {
			RDB.zadd('topics:recent', lastposttime, tid);
		});

		Topics.getTopicField(tid, 'cid', function(err, cid) {
			feed.updateCategory(cid);
			RDB.hincrby('category:' + cid, 'topic_count', 1);
		});
	}

	Topics.reIndexTopic = function(tid, callback) {
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				callback(err);
			} else {
				posts.reIndexPids(pids, function(err) {
					if (err) {
						callback(err);
					} else {
						callback(null);
					}
				});
			}
		});
	}

	Topics.reIndexAll = function(callback) {
		RDB.smembers('topics:tid', function(err, tids) {
			if (err) {
				callback(err, null);
			} else {

				async.each(tids, Topics.reIndexTopic, function(err) {
					if (err) {
						callback(err, null);
					} else {
						callback(null, 'All topics reindexed.');
					}
				});
			}
		});
	}

}(exports));