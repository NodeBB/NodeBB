var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	async = require('async'),
	topics = require('./topics.js');

(function(Categories) {

	Categories.getCategoryById = function(category_id, current_user, callback) {
		RDB.smembers('categories:' + category_id + ':tid', function(err, tids) {
			RDB.multi()
				.get('cid:' + category_id + ':name')
				.smembers('cid:' + category_id + ':active_users')
				.get('cid:' + category_id + ':slug')
				.exec(function(err, replies) {
					var	category_name = replies[0],
						active_users = replies[1],
						category_slug = replies[2];
					
					if (category_name === null) {
						callback(false);
					}

					var categoryData = {
							'category_name' : category_name,
							'show_sidebar' : 'show',
							'show_topic_button': 'show',
							'no_topics_message': 'hidden',
							'topic_row_size': 'span9',
							'category_id': category_id,
							'active_users': [],
							'topics' : [],
							'twitter-intent-url': 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(global.config.url + 'category/' + category_slug) + '&text=' + encodeURIComponent(category_name)
						};

					function getTopics(next) {
						Categories.getTopicsByTids(tids, current_user, function(topics) {
							// Float pinned topics to the top
							topics = topics.sort(function(a, b) {
								if (a.pinned !== b.pinned) return b.pinned - a.pinned;
								else {
									return b.timestamp - a.timestamp;
								}
							});
							console.log(topics);
							next(null, topics);
							
						}, category_id);
					}
					
					function getModerators(next) {
						Categories.getModerators(category_id, function(moderators) {
							next(null, moderators);
						});
					}

					function getActiveUsers(next) {
						user.getMultipleUserFields(active_users, ['username','userslug'], function(users) {
							var activeUserData = [];
							for(var uid in users) {
								activeUserData.push(users[uid]);
							}
							next(null, activeUserData);
						});
					}

					if (tids.length === 0) {
						getModerators(function(err, moderators) {
							categoryData.moderator_block_class = moderators.length > 0 ? '' : 'none';
							categoryData.moderators = moderators;
							categoryData.show_sidebar = 'hidden';
							categoryData.no_topics_message = 'show';

							callback(categoryData);
						});
					} else {
						async.parallel([getTopics, getModerators, getActiveUsers], function(err, results) {
							categoryData.topics = results[0];
							categoryData.moderator_block_class = results[1].length > 0 ? '' : 'none';
							categoryData.moderators = results[1];
							categoryData.active_users = results[2];
							callback(categoryData);
						});
					}
				});
		});
	}

	// not the permanent location for this function
	Categories.getLatestTopics = function(current_user, start, end, callback) {
		RDB.zrevrange('topics:recent', 0, -1, function(err, tids) {
			var latestTopics = {
				'category_name' : 'Recent',
				'show_sidebar' : 'hidden',
				'show_topic_button' : 'hidden',
				'no_topics_message' : 'hidden',
				'topic_row_size': 'span12',
				'category_id': false,
				'topics' : []
			};

			if (!tids.length) {
				callback(latestTopics);
				return;
			}

			Categories.getTopicsByTids(tids, current_user, function(topicData) {
				latestTopics.topics = topicData;
				callback(latestTopics);
			});
		});
	}

	// not the permanent location for this function
	Categories.getTopicsByTids = function(tids, current_user, callback, category_id /*temporary*/) {
		var title = [],
			uid = [],
			timestamp = [],
			slug = [],
			postcount = [],
			locked = [],
			deleted = [],
			pinned = [];

		for (var i=0, ii=tids.length; i<ii; i++) {
			title.push('tid:' + tids[i] + ':title');
			uid.push('tid:' + tids[i] + ':uid');
			timestamp.push('tid:' + tids[i] + ':timestamp');
			slug.push('tid:' + tids[i] + ':slug');
			postcount.push('tid:' + tids[i] + ':postcount');
			locked.push('tid:' + tids[i] + ':locked');
			deleted.push('tid:' + tids[i] + ':deleted');
			pinned.push('tid:' + tids[i] + ':pinned');
		}


		RDB.multi()
			.mget(title)
			.mget(uid)
			.mget(timestamp)
			.mget(slug)
			.mget(postcount)
			.mget(locked)
			.mget(deleted)
			.mget(pinned)
			.exec(function(err, replies) {
				var retrieved_topics = [];

				title = replies[0];
				uid = replies[1];
				timestamp = replies[2];
				slug = replies[3];
				postcount = replies[4];
				locked = replies[5];
				deleted = replies[6];
				pinned = replies[7];
			
				function getUserNames(next) {
					user.get_usernames_by_uids(uid, function(userNames) {
						next(null, userNames);
					});
				}

				function hasReadTopics(next) {
					topics.hasReadTopics(tids, current_user, function(hasRead) {
						next(null, hasRead);
					});
				}

				function getTeaserInfo(next) {
					topics.get_teasers(tids, function(teasers) {
						next(null, teasers);
					});
				}

				// temporary. I don't think this call should belong here
				function getPrivileges(next) {
					Categories.privileges(category_id, current_user, function(user_privs) {
						next(null, user_privs);
					});
				}

				async.parallel([getUserNames, hasReadTopics, getTeaserInfo, getPrivileges], function(err, results) {
					var usernames = results[0],
						hasReadTopics = results[1],
						teaserInfo = results[2],
						privileges = results[3];

					for (var i=0, ii=tids.length; i<ii; i++) {
						if (!deleted[i] || (deleted[i] && privileges.view_deleted) || uid[i] === current_user) {
							retrieved_topics.push({
								'tid' : tids[i],
								'title' : title[i],
								'uid' : uid[i],
								'username': usernames[i],
								'timestamp' : timestamp[i],
								'relativeTime': utils.relativeTime(timestamp[i]),
								'slug' : slug[i],
								'post_count' : postcount[i],
								'lock-icon': locked[i] === '1' ? 'icon-lock' : 'none',
								'deleted': deleted[i],
								'deleted-class': deleted[i] ? 'deleted' : '',
								'pinned': parseInt(pinned[i] || 0),	// For sorting purposes
								'pin-icon': pinned[i] === '1' ? 'icon-pushpin' : 'none',
								'badgeclass' : (hasReadTopics[i] && current_user !=0) ? '' : 'badge-important',
								'teaser_text': teaserInfo[i].text,
								'teaser_username': teaserInfo[i].username,
								'teaser_timestamp': utils.relativeTime(teaserInfo[i].timestamp)
							});
						}
					}

					callback(retrieved_topics);
				});
			});
	}

	Categories.getAllCategories = function(callback, current_user) {
		RDB.lrange('categories:cid', 0, -1, function(err, cids) {
			RDB.handle(err);
			Categories.getCategories(cids, callback, current_user);
		});
	}

	Categories.getModerators = function(cid, callback) {
		RDB.smembers('cid:' + cid + ':moderators', function(err, mods) {
			if (mods.length === 0) return callback([]);

			user.getMultipleUserFields(mods, ['username'], function(details) {
				var moderators = [];
				for(u in details) {
					if (details.hasOwnProperty(u)) {
						moderators.push({ username: details[u].username });
					}
				}
				callback(moderators);
			});
		});
	}


	Categories.privileges = function(cid, uid, callback) {
		function isModerator(next) {
			user.isModerator(uid, cid, function(isMod) {
					next(null, isMod);
				});
		}

		function isAdministrator(next) {
			user.isAdministrator(uid, function(isAdmin) {
					next(null, isAdmin);
				});
		}

		async.parallel([isModerator, isAdministrator], function(err, results) {
			callback({
				editable: results.indexOf(true) !== -1 ? true : false,
				view_deleted: results.indexOf(true) !== -1 ? true : false
			});
		});
	}



	Categories.hasReadCategories = function(cids, uid, callback) {
		var batch = RDB.multi();

		for (var i=0, ii=cids.length; i<ii; i++) {
			batch.sismember('cid:' + cids[i] + ':read_by_uid', uid);	
		}
		
		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	}

	Categories.getRecentReplies = function(cid, callback) {
		RDB.zrevrange('categories:recent_posts:cid:' + cid, 0, 4, function(err, pids) {
			if (pids.length == 0) {
				callback(false);
				return;
			}
			posts.getPostSummaryByPids(pids, function(posts) {
				callback(posts);
			});
		});
	}

	Categories.getCategories = function(cids, callback, current_user) {
		if (cids.length === 0) {
			callback({'categories' : []});
			return;
		}
		
		var name = [],
			description = [],
			icon = [],
			blockclass = [],
			slug = [],
			topic_count = [],
			has_read = {};

		for (var i=0, ii=cids.length; i<ii; i++) {
			name.push('cid:' + cids[i] + ':name');
			description.push('cid:' + cids[i] + ':description');
			icon.push('cid:' + cids[i] + ':icon');
			blockclass.push('cid:' + cids[i] + ':blockclass');
			slug.push('cid:' + cids[i] + ':slug');
			topic_count.push('cid:' + cids[i] + ':topiccount');
		}
		
		RDB.multi()
			.mget(name)
			.mget(description)
			.mget(icon)
			.mget(blockclass)
			.mget(slug)
			.mget(topic_count)
			.exec(function(err, replies) {
				name = replies[0];
				description = replies[1];
				icon = replies[2];
				blockclass = replies[3];
				slug = replies[4];
				topic_count = replies[5];

				
				function generateCategories() {
					var categories = [];
					for (var i=0, ii=cids.length; i<ii; i++) {
						categories.push({
							'name' : name[i],
							'cid' : cids[i],
							'slug' : slug[i],
							'description' : description[i],
							'blockclass' : blockclass[i],
							'icon' : icon[i],
							'badgeclass' : (!topic_count[i] || (has_read[i] && current_user !=0)) ? '' : 'badge-important',
							'topic_count' : topic_count[i] || 0
						});
					}

					callback({'categories': categories});
				}

				Categories.hasReadCategories(cids, current_user, function(read_data) {
					has_read = read_data;
					generateCategories();
				});
				
			});
	};

}(exports));