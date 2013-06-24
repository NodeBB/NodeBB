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

	CategoriesAdmin.update = function(modified, socket) {
		var updated = [];

		for (var cid in modified) {
			var category = modified[cid];

			for (var key in category) {
				RDB.set('cid:' + cid + ':' + key, category[key]);

				if (key == 'name') {
					// reset slugs if name is updated
					var slug = cid + '/' + utils.slugify(category[key]);
					RDB.set('cid:' + cid + ':slug', slug);
					RDB.set('category:slug:' + slug + ':cid', cid);

					RDB.smembers('categories:' + cid + ':tid', function(err, tids) {
						var pipe = RDB.multi();

						for (var tid in tids) {
							pipe.set(schema.topics(tid).category_name, category[key]);
							pipe.set(schema.topics(tid).category_slug, slug);
						}
						pipe.exec();
					});
					
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