var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js'),
	async = require('async');

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

	Categories.get = function(callback, current_user) {
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