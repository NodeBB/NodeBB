var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js');

(function(Categories) {


	// An admin-only function. Seeing how we have no control panel yet ima leave this right here. sit pretty, you
	Categories.create = function(data, callback) {
		RDB.incr('global:next_category_id', function(cid) {
			var slug = cid + '/' + utils.slugify(data.name);
			RDB.rpush('categories:cid', cid);

			// Topic Info
			RDB.set('cid:' + cid + ':name', data.name);
			RDB.set('cid:' + cid + ':description', data.description);
			RDB.set('cid:' + cid + ':slug', slug);
		
			RDB.set('category:slug:' + slug + ':cid', cid);

			if (callback) callback({'status': 1});
		});
	};



	Categories.get = function(callback) {
		RDB.lrange('categories:cid', 0, -1, function(cids) {
			var name = [],
				description = [],
				slug = [];

			for (var i=0, ii=cids.length; i<ii; i++) {
				name.push('cid:' + cids[i] + ':name');
				description.push('cid:' + cids[i] + ':description');
				slug.push('cid:' + cids[i] + ':slug');
			}

			if (cids.length > 0) {
				RDB.multi()
					.mget(name)
					.mget(description)
					.mget(slug)
					.exec(function(err, replies) {
						name = replies[0];
						description = replies[1];
						slug = replies[2];
						
						var categories = [];
						for (var i=0, ii=cids.length; i<ii; i++) {
							categories.push({
								'name' : name[i],
								'cid' : cids[i],
								'slug' : slug[i],
								'description' : description[i],
								/*'topics' : [0,1], later
								'latest_post' : {
									'uid' : 1,
									'pid' : 1,
									timestamp and shit
								}*/
							});
						}

						callback({'categories': categories});
					});
			} else callback({'categories' : []});
		});
	}

}(exports));