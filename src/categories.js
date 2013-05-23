var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	async = require('async'),
	topics = require('./topics.js');

(function(Categories) {


	// An admin-only function. Seeing how we have no control panel yet ima leave this right here. sit pretty, you
	Categories.create = function(data, callback) {
		RDB.incr('global:next_category_id', function(err, cid) {
			RDB.handle(err);

			var slug = cid + '/' + utils.slugify(data.name);
			RDB.rpush('categories:cid', cid);

			// Topic Info
			RDB.set('cid:' + cid + ':name', data.name);
			RDB.set('cid:' + cid + ':description', data.description);
			RDB.set('cid:' + cid + ':icon', data.icon);
			RDB.set('cid:' + cid + ':blockclass', data.blockclass);
			RDB.set('cid:' + cid + ':slug', slug);
		
			RDB.set('category:slug:' + slug + ':cid', cid);

			if (callback) callback({'status': 1});
		});
	};

	Categories.privileges = function(cid, uid, callback) {
		async.parallel([
			// function(next) {
			// 	user.getUserField(uid, 'reputation', function(reputation) {
			// 		next(null, reputation >= config.privilege_thresholds.manage_category);
			// 	});
			// },
			function(next) {
				user.isModerator(uid, cid, function(isMod) {
					next(null, isMod);
				});
			}, function(next) {
				user.isAdministrator(uid, function(isAdmin) {
					next(null, isAdmin);
				});
			}
		], function(err, results) {
			callback({
				editable: results.indexOf(true) !== -1 ? true : false,
				view_deleted: results.indexOf(true) !== -1 ? true : false
			});
		});
	}

	Categories.edit = function(data, callback) {
		// just a reminder to self that name + slugs are stored into topics data as well.
	};

	Categories.get = function(callback, category_id, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		var range_var = (category_id) ? 'categories:' + category_id + ':tid'  : 'topics:tid';

		RDB.smembers(range_var, function(err, tids) {
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

			var multi = RDB.multi()
				.get('cid:' + category_id + ':name')
				.smembers('cid:' + category_id + ':active_users');

			if (tids.length > 0) {
				multi
					.mget(title)
					.mget(uid)
					.mget(timestamp)
					.mget(slug)
					.mget(postcount)
					.mget(locked)
					.mget(deleted)
					.mget(pinned)
			}
			
			multi.exec(function(err, replies) {
				category_name = replies[0];

				if(category_id && category_name === null) {
					callback(false);
					return;
				}
				
				active_usernames = replies[1];
				var retrieved_topics = [];

				if (tids.length == 0) {
					callback({
						'category_name' : category_id ? category_name : 'Recent',
						'show_topic_button' : category_id ? 'show' : 'hidden',
						'category_id': category_id || 0,
						'topics' : []
					});
				}

				title = replies[2];
				uid = replies[3];
				timestamp = replies[4];
				slug = replies[5];
				postcount = replies[6];
				locked = replies[7];
				deleted = replies[8];
				pinned = replies[9];

				var usernames,
					has_read,
					moderators,
					teaser_info,
					privileges;

				function generate_topic() {
					if (!usernames || !has_read || !moderators || !teaser_info || !privileges) return;

					if (tids.length > 0) {
						for (var i=0, ii=title.length; i<ii; i++) {
							if (!deleted[i] || (deleted[i] && privileges.view_deleted) || uid[i] === current_user) {
								retrieved_topics.push({
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
									'badgeclass' : (has_read[i] && current_user !=0) ? '' : 'badge-important',
									'teaser_text': teaser_info[i].text,
									'teaser_username': teaser_info[i].username
								});
							}
						}
					}

					// Float pinned topics to the top
					retrieved_topics = retrieved_topics.sort(function(a, b) {
						if (a.pinned !== b.pinned) return b.pinned - a.pinned;
						else {
							// Sort by datetime descending
							return b.timestamp - a.timestamp;
						}
					});

					var active_users = [];
					for (var username in active_usernames) {
						active_users.push({'username': active_usernames[username]});
					}

					callback({
						'category_name' : category_id ? category_name : 'Recent',
						'show_topic_button' : category_id ? 'show' : 'hidden',
						'category_id': category_id || 0,
						'topics': retrieved_topics,
						'active_users': active_users,
						'moderator_block_class': moderators.length > 0 ? '' : 'none',
						'moderators': moderators
					});
				}
				
				user.get_usernames_by_uids(uid, function(userNames) {
					usernames = userNames;
					generate_topic();
				});	

				topics.hasReadTopics(tids, current_user, function(hasRead) {
					has_read = hasRead;
					generate_topic();
				});

				Categories.getModerators(category_id, function(mods) {
					moderators = mods;
					generate_topic();
				});

				topics.get_teasers(tids, function(teasers) {
					teaser_info = teasers;
					generate_topic();
				});

				Categories.privileges(category_id, current_user, function(user_privs) {
					privileges = user_privs;
				});
			});
		});
	}

	Categories.getAllCategories = function(callback, current_user) {
		RDB.lrange('categories:cid', 0, -1, function(err, cids) {
			RDB.handle(err);
			Categories.get_category(cids, callback, current_user);
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


	Categories.hasReadCategories = function(cids, uid, callback) {
		var batch = RDB.multi();

		for (var i=0, ii=cids.length; i<ii; i++) {
			batch.sismember('cid:' + cids[i] + ':read_by_uid', uid);	
		}
		
		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	}



	Categories.get_category = function(cids, callback, current_user) {
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

		if (cids.length > 0) {
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
		} else callback({'categories' : []});
	};

}(exports));