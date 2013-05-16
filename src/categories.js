var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js');

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

	Categories.edit = function(data, callback) {
		// just a reminder to self that name + slugs are stored into topics data as well.
	};

	Categories.get = function(callback) {
		RDB.lrange('categories:cid', 0, -1, function(err, cids) {
			RDB.handle(err);
			Categories.get_category(cids, callback);
		});
	}

	Categories.getModerators = function(cid, callback) {
		RDB.smembers('cid:' + cid + ':moderators', function(err, mods) {
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

	Categories.get_category = function(cids, callback) {
		var name = [],
			description = [],
			icon = [],
			blockclass = [],
			slug = [];

		for (var i=0, ii=cids.length; i<ii; i++) {
			name.push('cid:' + cids[i] + ':name');
			description.push('cid:' + cids[i] + ':description');
			icon.push('cid:' + cids[i] + ':icon');
			blockclass.push('cid:' + cids[i] + ':blockclass');
			slug.push('cid:' + cids[i] + ':slug');
		}

		if (cids.length > 0) {
			RDB.multi()
				.mget(name)
				.mget(description)
				.mget(icon)
				.mget(blockclass)
				.mget(slug)
				.exec(function(err, replies) {
					name = replies[0];
					description = replies[1];
					icon = replies[2];
					blockclass = replies[3];
					slug = replies[4];
					
					var categories = [];
					for (var i=0, ii=cids.length; i<ii; i++) {
						categories.push({
							'name' : name[i],
							'cid' : cids[i],
							'slug' : slug[i],
							'description' : description[i],
							'blockclass' : blockclass[i],
							'icon' : icon[i]
						});
					}

					callback({'categories': categories});
				});
		} else callback({'categories' : []});
	};

}(exports));