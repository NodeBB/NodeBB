'use strict';

var async = require('async');

var db = require('../database');
var groups = require('../groups');
var plugins = require('../plugins');
var privileges = require('../privileges');
var utils = require('../utils');

module.exports = function (Categories) {
	Categories.create = function (data, callback) {
		var category;
		var parentCid = data.parentCid ? data.parentCid : 0;

		async.waterfall([
			function (next) {
				db.incrObjectField('global', 'nextCid', next);
			},
			function (cid, next) {
				data.name = data.name || 'Category ' + cid;
				var slug = cid + '/' + utils.slugify(data.name);
				var order = data.order || cid;	// If no order provided, place it at the end
				var colours = Categories.assignColours();

				category = {
					cid: cid,
					name: data.name,
					description: data.description ? data.description : '',
					descriptionParsed: data.descriptionParsed ? data.descriptionParsed : '',
					icon: data.icon ? data.icon : '',
					bgColor: data.bgColor || colours[0],
					color: data.color || colours[1],
					slug: slug,
					parentCid: parentCid,
					topic_count: 0,
					post_count: 0,
					disabled: data.disabled ? 1 : 0,
					order: order,
					link: data.link || '',
					numRecentReplies: 1,
					class: (data.class ? data.class : 'col-md-3 col-xs-6'),
					imageClass: 'cover',
				};

				if (data.backgroundImage) {
					category.backgroundImage = data.backgroundImage;
				}

				plugins.fireHook('filter:category.create', { category: category, data: data }, next);
			},
			function (data, next) {
				category = data.category;

				var defaultPrivileges = [
					'find',
					'read',
					'topics:read',
					'topics:create',
					'topics:reply',
					'topics:tag',
					'posts:edit',
					'posts:history',
					'posts:delete',
					'posts:upvote',
					'posts:downvote',
					'topics:delete',
				];

				async.series([
					async.apply(db.setObject, 'category:' + category.cid, category),
					function (next) {
						if (category.descriptionParsed) {
							return next();
						}
						Categories.parseDescription(category.cid, category.description, next);
					},
					async.apply(db.sortedSetAdd, 'categories:cid', category.order, category.cid),
					async.apply(db.sortedSetAdd, 'cid:' + parentCid + ':children', category.order, category.cid),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'administrators'),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'registered-users'),
					async.apply(privileges.categories.give, ['find', 'read', 'topics:read'], category.cid, 'guests'),
					async.apply(privileges.categories.give, ['find', 'read', 'topics:read'], category.cid, 'spiders'),
				], next);
			},
			function (results, next) {
				async.series([
					function (next) {
						if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
							return Categories.copySettingsFrom(data.cloneFromCid, category.cid, !data.parentCid, next);
						}

						next();
					},
					function (next) {
						if (data.cloneChildren) {
							return duplicateCategoriesChildren(category.cid, data.cloneFromCid, data.uid, next);
						}

						next();
					},
				], function (err) {
					next(err, category);
				});
			},
			function (category, next) {
				plugins.fireHook('action:category.create', { category: category });
				next(null, category);
			},
		], callback);
	};

	function duplicateCategoriesChildren(parentCid, cid, uid, callback) {
		Categories.getChildren([cid], uid, function (err, children) {
			if (err || !children.length) {
				return callback(err);
			}

			children = children[0];

			children.forEach(function (child) {
				child.parentCid = parentCid;
				child.cloneFromCid = child.cid;
				child.cloneChildren = true;
				child.name = utils.decodeHTMLEntities(child.name);
				child.description = utils.decodeHTMLEntities(child.description);
				child.uid = uid;
			});

			async.each(children, Categories.create, callback);
		});
	}

	Categories.assignColours = function () {
		var backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
		var text = ['#fff', '#fff', '#333', '#fff', '#333', '#fff', '#fff', '#fff'];
		var index = Math.floor(Math.random() * backgrounds.length);

		return [backgrounds[index], text[index]];
	};

	Categories.copySettingsFrom = function (fromCid, toCid, copyParent, callback) {
		var destination;
		async.waterfall([
			function (next) {
				async.parallel({
					source: async.apply(db.getObject, 'category:' + fromCid),
					destination: async.apply(db.getObject, 'category:' + toCid),
				}, next);
			},
			function (results, next) {
				if (!results.source) {
					return next(new Error('[[error:invalid-cid]]'));
				}
				destination = results.destination;

				var tasks = [];

				if (copyParent && utils.isNumber(destination.parentCid)) {
					tasks.push(async.apply(db.sortedSetRemove, 'cid:' + destination.parentCid + ':children', toCid));
				}

				if (copyParent && utils.isNumber(results.source.parentCid)) {
					tasks.push(async.apply(db.sortedSetAdd, 'cid:' + results.source.parentCid + ':children', results.source.order, toCid));
				}

				destination.description = results.source.description;
				destination.descriptionParsed = results.source.descriptionParsed;
				destination.icon = results.source.icon;
				destination.bgColor = results.source.bgColor;
				destination.color = results.source.color;
				destination.link = results.source.link;
				destination.numRecentReplies = results.source.numRecentReplies;
				destination.class = results.source.class;
				destination.imageClass = results.source.imageClass;

				if (copyParent) {
					destination.parentCid = results.source.parentCid || 0;
				}

				tasks.push(async.apply(db.setObject, 'category:' + toCid, destination));

				async.series(tasks, next);
			},
			function (results, next) {
				Categories.copyPrivilegesFrom(fromCid, toCid, next);
			},
		], function (err) {
			callback(err, destination);
		});
	};

	Categories.copyPrivilegesFrom = function (fromCid, toCid, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:categories.copyPrivilegesFrom', {
					privileges: privileges.privilegeList.slice(),
					fromCid: fromCid,
					toCid: toCid,
				}, next);
			},
			function (data, next) {
				async.each(data.privileges, function (privilege, next) {
					copyPrivilege(privilege, data.fromCid, data.toCid, next);
				}, next);
			},
		], callback);
	};

	function copyPrivilege(privilege, fromCid, toCid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('group:cid:' + toCid + ':privileges:' + privilege + ':members', 0, -1, next);
			},
			function (currentMembers, next) {
				async.eachSeries(currentMembers, function (member, next) {
					groups.leave('cid:' + toCid + ':privileges:' + privilege, member, next);
				}, next);
			},
			function (next) {
				db.getSortedSetRange('group:cid:' + fromCid + ':privileges:' + privilege + ':members', 0, -1, next);
			},
			function (members, next) {
				if (!members || !members.length) {
					return callback();
				}

				async.eachSeries(members, function (member, next) {
					groups.join('cid:' + toCid + ':privileges:' + privilege, member, next);
				}, next);
			},
		], callback);
	}
};
