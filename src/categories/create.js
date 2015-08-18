'use strict';

var async = require('async'),
	db = require('../database'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils');

module.exports = function(Categories) {

	Categories.create = function(data, callback) {
		var category;
		var parentCid = data.parentCid ? data.parentCid : 0;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextCid', next);
			},
			function(cid, next) {
				var slug = cid + '/' + utils.slugify(data.name),
					order = data.order || cid,	// If no order provided, place it at the end
					colours = Categories.assignColours();

				category = {
					cid: cid,
					name: data.name,
					description: ( data.description ? data.description : '' ),
					icon: ( data.icon ? data.icon : '' ),
					bgColor: data.bgColor || colours[0],
					color: data.color || colours[1],
					slug: slug,
					parentCid: parentCid,
					topic_count: 0,
					post_count: 0,
					disabled: 0,
					order: order,
					link: '',
					numRecentReplies: 1,
					class: ( data.class ? data.class : 'col-md-3 col-xs-6' ),
					imageClass: 'auto'
				};

				plugins.fireHook('filter:category.create', {category: category, data: data}, next);
			},
			function(data, next) {
				category = data.category;

				var defaultPrivileges = ['find', 'read', 'topics:create', 'topics:reply'];

				async.series([
					async.apply(db.setObject, 'category:' + category.cid, category),
					async.apply(db.sortedSetAdd, 'categories:cid', category.order, category.cid),
					async.apply(db.sortedSetAdd, 'cid:' + parentCid + ':children', category.order, category.cid),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'administrators'),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'registered-users'),
					async.apply(privileges.categories.give, ['find', 'read'], category.cid, 'guests')
				], next);
			},
			function(results, next) {
				plugins.fireHook('action:category.create', category);
				next(null, category);
			}
		], callback);
	};

	Categories.assignColours = function() {
		var backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'],
			text = ['#fff', '#fff', '#333', '#fff', '#333', '#fff', '#fff', '#fff'],
			index = Math.floor(Math.random() * backgrounds.length);

		return [backgrounds[index], text[index]];
	};
};
