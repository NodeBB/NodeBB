var	RDB = require('./../redis.js'),
	utils = require('./../../public/src/utils.js'),
	categories = require('./../categories.js');

(function(CategoriesAdmin) {

	CategoriesAdmin.create = function(data, callback) {
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

	CategoriesAdmin.edit = function(data, callback) {
		// just a reminder to self that name + slugs are stored into topics data as well.
	};

}(exports));