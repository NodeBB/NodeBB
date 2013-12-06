var db = require('./../database'),
	utils = require('./../../public/src/utils'),
	categories = require('./../categories');

(function(CategoriesAdmin) {

	CategoriesAdmin.update = function(modified, socket) {
		var updated = [];

		for (var cid in modified) {
			var category = modified[cid];

			for (var key in category) {
				db.setObjectField('category:' + cid, key, category[key]);

				if (key == 'name') {
					// reset slugs if name is updated
					var slug = cid + '/' + utils.slugify(category[key]);
					db.setObjectField('category:' + cid, 'slug', slug);
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