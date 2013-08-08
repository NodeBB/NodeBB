var	RDB = require('./../redis.js'),
	utils = require('./../../public/src/utils.js'),
	categories = require('./../categories.js');

(function(CategoriesAdmin) {

	CategoriesAdmin.create = function(data, callback) {
		RDB.incr('global:next_category_id', function(err, cid) {
			RDB.handle(err);

			var slug = cid + '/' + utils.slugify(data.name);
			RDB.rpush('categories:cid', cid);

			RDB.hmset('category:' + cid, {
				cid: cid,
				name: data.name,
				description: data.description,
				icon: data.icon,
				blockclass: data.blockclass,
				slug: slug,
				topic_count: 0,
				disabled: 0
			});

			RDB.set('categoryslug:' + slug + ':cid', cid);

			if (callback) callback({'status': 1});
		});
	};

	CategoriesAdmin.update = function(modified, socket) {
		var updated = [];

		for (var cid in modified) {
			var category = modified[cid];
			
			for (var key in category) {
				RDB.hset('category:' + cid, key, category[key]);

				if (key == 'name') {
					// reset slugs if name is updated
					var slug = cid + '/' + utils.slugify(category[key]);
					RDB.hset('category:' + cid, 'slug', slug);
					RDB.set('categoryslug:' + slug + ':cid', cid);
				}
			}

			updated.push(cid);
		}

		socket.emit('event:alert', {
			title: 'Updated Categories',
			message: 'Category IDs ' + updated.join(', ') + ' was successfully updated.',
			type: 'success',
			timeout: 2000
		});
	};

}(exports));