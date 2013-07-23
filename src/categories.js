var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	async = require('async'),
	topics = require('./topics.js');

(function(Categories) {

	Categories.getCategoryById = function(category_id, current_user, callback) {
		
		Categories.getCategoryData(category_id, function(err, categoryData) {
			if (err) return callback(err);

			var category_name = categoryData.name,
				category_slug = categoryData.slug;

			function getTopicIds(next) {
				Categories.getTopicIds(category_id, next);
			}
			function getActiveUsers(next) {
				Categories.getActiveUsers(category_id, next);
			}

			async.parallel([getTopicIds, getActiveUsers], function(err, results) {
				var tids = results[0],
					active_users = results[1];

				var categoryData = {
					'category_name' : category_name,
					'show_sidebar' : 'show',
					'show_topic_button': 'inline-block',
					'no_topics_message': 'hidden',
					'topic_row_size': 'span9',
					'category_id': category_id,
					'active_users': [],
					'topics' : [],
					'twitter-intent-url': 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(global.nconf.get('url') + 'category/' + category_slug) + '&text=' + encodeURIComponent(category_name),
					'facebook-share-url': 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(global.nconf.get('url') + 'category/' + category_slug),
					'google-share-url': 'https://plus.google.com/share?url=' + encodeURIComponent(global.nconf.get('url') + 'category/' + category_slug)
				};

				function getTopics(next) {
					Categories.getTopicsByTids(tids, current_user, function(topics) {
						// Float pinned topics to the top
						topics = topics.sort(function(a, b) {
							if (a.pinned !== b.pinned) return b.pinned - a.pinned;
							else {
								return b.lastposttime - a.lastposttime;
							}
						});
						next(null, topics);
						
					}, category_id);
				}
				
				function getModerators(next) {
					Categories.getModerators(category_id, next);
				}

				function getActiveUsers(next) {
					user.getMultipleUserFields(active_users, ['username', 'userslug', 'picture'], function(users) {
						next(null, users);
					});
				}

				if (tids.length === 0) {
					getModerators(function(err, moderators) {
						categoryData.moderator_block_class = moderators.length > 0 ? '' : 'none';
						categoryData.moderators = moderators;
						categoryData.show_sidebar = 'hidden';
						categoryData.no_topics_message = 'show';

						callback(null, categoryData);
					});
				} else {
					async.parallel([getTopics, getModerators, getActiveUsers], function(err, results) {
						categoryData.topics = results[0];
						categoryData.moderator_block_class = results[1].length > 0 ? '' : 'none';
						categoryData.moderators = results[1];
						categoryData.active_users = results[2];
						callback(null, categoryData);
					});
				}

			});
		});
	}

	Categories.getTopicIds = function(cid, callback) {
		RDB.smembers('categories:' + cid + ':tid', callback);
	}

	Categories.getActiveUsers = function(cid, callback) {
		RDB.smembers('cid:' + cid + ':active_users', callback);
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

		var retrieved_topics = [];
		
		function getTopicInfo(topicData, callback) {

			function getUserName(next) {
				user.getUserField(topicData.uid, 'username', function(username) {
					next(null, username);
				});
			}

			function hasReadTopic(next) {
				topics.hasReadTopic(topicData.tid, current_user, function(hasRead) {
					next(null, hasRead);
				});
			}

			function getTeaserInfo(next) {
				topics.getTeaser(topicData.tid, function(err, teaser) {
					next(null, teaser || {});
				});
			}

			// temporary. I don't think this call should belong here
			function getPrivileges(next) {
				Categories.privileges(category_id, current_user, function(user_privs) {
					next(null, user_privs);
				});
			}

			async.parallel([getUserName, hasReadTopic, getTeaserInfo, getPrivileges], function(err, results) {
				var username = results[0],
					hasReadTopic = results[1],
					teaserInfo = results[2],
					privileges = results[3];

				callback({
					username: username,
					hasread: hasReadTopic,
					teaserInfo: teaserInfo,
					privileges: privileges
				});
			});
		}

		function isTopicVisible(topicData, topicInfo) {
			var deleted = parseInt(topicData.deleted, 10) !== 0;
			return !deleted || (deleted && topicInfo.privileges.view_deleted) || topicData.uid === current_user;
		}

		function loadTopic(tid, callback) {
			topics.getTopicData(tid, function(topicData) {
				if(!topicData) {
					return callback(null);
				}
				
				getTopicInfo(topicData, function(topicInfo) {

					topicData['pin-icon'] = topicData.pinned === '1' ? 'icon-pushpin' : 'none';
					topicData['lock-icon'] = topicData.locked === '1' ? 'icon-lock' : 'none';
					topicData['deleted-class'] = topicData.deleted === '1' ? 'deleted' : '';

					topicData.relativeTime = utils.relativeTime(topicData.timestamp);

					topicData.username = topicInfo.username;
					topicData.badgeclass = (topicInfo.hasread && current_user != 0) ? '' : 'badge-important';
					topicData.teaser_text = topicInfo.teaserInfo.text || '',
					topicData.teaser_username = topicInfo.teaserInfo.username || '';
					topicData.teaser_userpicture = topicInfo.teaserInfo.picture || '';
					topicData.teaser_timestamp = topicInfo.teaserInfo.timestamp ? utils.relativeTime(topicInfo.teaserInfo.timestamp) : '';

					if (isTopicVisible(topicData, topicInfo))
						retrieved_topics.push(topicData);
					
					callback(null);					
				});
			});
		}
		
		async.eachSeries(tids, loadTopic, function(err) {
			if(!err) {
				callback(retrieved_topics);
			}
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
			if(!err) {
				if(mods && mods.length) {
					user.getMultipleUserFields(mods, ['username'], function(moderators) {
						callback(null, moderators);
					});
				} else {
					callback(null, []);
				}
			} else {
				callback(err, null);
			}

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

	Categories.isTopicsRead = function(cid, uid, callback) {
		RDB.smembers('categories:' + cid + ':tid', function(err, tids) {

			topics.hasReadTopics(tids, uid, function(hasRead) {

				var allread = true;
				for (var i=0, ii=tids.length; i<ii; i++) {
					if(hasRead[i] === 0) {
						allread = false;
						break;
					}
				}
				callback(allread);				
			});
		});
	}

	Categories.markAsRead = function(cid, uid) {
		RDB.sadd('cid:' + cid + ':read_by_uid', uid);			
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

	Categories.hasReadCategory = function(cid, uid, callback) {
		RDB.sismember('cid:' + cid + ':read_by_uid', uid, function(err, hasRead) {
			RDB.handle(err);
			
			callback(hasRead);
		});	
	}

	Categories.getRecentReplies = function(cid, count, callback) {
		RDB.zrevrange('categories:recent_posts:cid:' + cid, 0, (count<10)?10:count, function(err, pids) {

			if (pids.length == 0) {
				callback([]);
				return;
			}

			posts.getPostSummaryByPids(pids, function(posts) {
				if(posts.length > count) {
					posts = posts.slice(0, count);
				}
				callback(posts);
			});
		});
	}

	Categories.moveRecentReplies = function(tid, oldCid, cid, callback) {
		topics.getPids(tid, function(err, pids) {
			if(!err) {

				function movePost(pid, callback) {
					posts.getPostField(pid, 'timestamp', function(timestamp) {
						RDB.zrem('categories:recent_posts:cid:' + oldCid, pid);	
						RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);	
					});
				}

				async.each(pids, movePost, function(err) {
					if(!err) {
						callback(null, 1)
					} else {
						console.log(err);
						callback(err, null);
					}
				});
			} else {
				console.log(err);
				callback(err, null);
			}
		});
	}

	Categories.getCategoryData = function(cid, callback) {
		RDB.exists('category:' + cid, function(err, exists) {
			if (exists) RDB.hgetall('category:' + cid, callback);
			else callback(new Error('No category found!'));
		});
	}
	
	Categories.getCategoryFields = function(cid, fields, callback) {
		RDB.hmgetObject('category:' + cid, fields, function(err, data) {
			if(err === null) 
				callback(data);
			else
				console.log(err);
		});		
	}
	
	Categories.setCategoryField = function(cid, field, value) {
		RDB.hset('category:' + cid, field, value);
	}

	Categories.incrementCategoryFieldBy = function(cid, field, value) {
		RDB.hincrby('category:' + cid, field, value);
	}

	Categories.getCategories = function(cids, callback, current_user) {
		if (!cids || !Array.isArray(cids) || cids.length === 0) {
			callback({'categories' : []});
			return;
		}
		
		var categories = [];

		function getCategory(cid, callback) {
			Categories.getCategoryData(cid, function(err, categoryData) {
				
				if(err) {
					callback(err);
					return;
				}

				Categories.hasReadCategory(cid, current_user, function(hasRead) {
					categoryData['badgeclass'] = (parseInt(categoryData.topic_count,10) === 0 || (hasRead && current_user != 0)) ? '' : 'badge-important';

					categories.push(categoryData);
					callback(null);
				}) ;
			});			
		}
				
		async.eachSeries(cids, getCategory, function(err) {
			if(err) {
				console.log(err);
				callback(null);
				return;
			}
			
			callback({'categories': categories});			
		});
		
	};	

}(exports));

