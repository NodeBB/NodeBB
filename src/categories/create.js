'use strict';

var async = require('async'),
	db = require('../database'),
	utils = require('../../public/src/utils');

module.exports = function(Categories) {

	Categories.create = function(data, callback) {
		db.incrObjectField('global', 'nextCid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			var slug = cid + '/' + utils.slugify(data.name);

			var category = {
				cid: cid,
				name: data.name,
				description: data.description,
				icon: data.icon,
				bgColor: data.bgColor,
				color: data.color,
				slug: slug,
				parentCid: 0,
				topic_count: 0,
				post_count: 0,
				disabled: 0,
				order: data.order,
				link: '',
				numRecentReplies: 1,
				class: 'col-md-3 col-xs-6',
				imageClass: 'auto'
			};

			async.series([
				async.apply(db.setObject, 'category:' + cid, category),
				async.apply(db.sortedSetAdd, 'categories:cid', data.order, cid)
			], function(err) {
				if (err) {
					return callback(err);
				}

				callback(null, category);
			});
		});
	};
};
