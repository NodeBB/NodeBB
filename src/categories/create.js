'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var groups = require('../groups');
var plugins = require('../plugins');
var privileges = require('../privileges');
var utils = require('../utils');
var cache = require('../cache');

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
					isSection: 0,
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
				const modPrivileges = defaultPrivileges.concat([
					'posts:view_deleted',
					'purge',
				]);

				async.series([
					async.apply(db.setObject, 'category:' + category.cid, category),
					function (next) {
						if (category.descriptionParsed) {
							return next();
						}
						Categories.parseDescription(category.cid, category.description, next);
					},
					async.apply(db.sortedSetsAdd, ['categories:cid', 'cid:' + parentCid + ':children'], category.order, category.cid),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'registered-users'),
					async.apply(privileges.categories.give, modPrivileges, category.cid, ['administrators', 'Global Moderators']),
					async.apply(privileges.categories.give, ['find', 'read', 'topics:read'], category.cid, ['guests', 'spiders']),
				], next);
			},
			function (results, next) {
				cache.del(['categories:cid', 'cid:' + parentCid + ':children']);
				if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
					return Categories.copySettingsFrom(data.cloneFromCid, category.cid, !data.parentCid, next);
				}

				next(null, category);
			},
			function (_category, next) {
				category = _category;
				if (data.cloneChildren) {
					return duplicateCategoriesChildren(category.cid, data.cloneFromCid, data.uid, next);
				}

				next();
			},
			function (next) {
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

				const oldParent = parseInt(destination.parentCid, 10) || 0;
				const newParent = parseInt(results.source.parentCid, 10) || 0;
				if (copyParent && newParent !== parseInt(toCid, 10)) {
					tasks.push(async.apply(db.sortedSetRemove, 'cid:' + oldParent + ':children', toCid));
					tasks.push(async.apply(db.sortedSetAdd, 'cid:' + newParent + ':children', results.source.order, toCid));
					tasks.push(function (next) {
						cache.del(['cid:' + oldParent + ':children', 'cid:' + newParent + ':children']);
						setImmediate(next);
					});
				}

				destination.description = results.source.description;
				destination.descriptionParsed = results.source.descriptionParsed;
				destination.icon = results.source.icon;
				destination.bgColor = results.source.bgColor;
				destination.color = results.source.color;
				destination.link = results.source.link;
				destination.numRecentReplies = results.source.numRecentReplies;
				destination.class = results.source.class;
				destination.image = results.source.image;
				destination.imageClass = results.source.imageClass;

				if (copyParent) {
					destination.parentCid = results.source.parentCid || 0;
				}

				tasks.push(async.apply(db.setObject, 'category:' + toCid, destination));

				async.series(tasks, next);
			},
			function (results, next) {
				copyTagWhitelist(fromCid, toCid, next);
			},
			function (next) {
				Categories.copyPrivilegesFrom(fromCid, toCid, next);
			},
		], function (err) {
			callback(err, destination);
		});
	};

	function copyTagWhitelist(fromCid, toCid, callback) {
		var data;
		async.waterfall([
			function (next) {
				db.getSortedSetRangeWithScores('cid:' + fromCid + ':tag:whitelist', 0, -1, next);
			},
			function (_data, next) {
				data = _data;
				db.delete('cid:' + toCid + ':tag:whitelist', next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + toCid + ':tag:whitelist', data.map(item => item.score), data.map(item => item.value), next);
			},
		], callback);
	}

	Categories.copyPrivilegesFrom = function (fromCid, toCid, group, callback) {
		if (typeof group === 'function') {
			callback = group;
			group = '';
		}

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:categories.copyPrivilegesFrom', {
					privileges: group ? privileges.groupPrivilegeList.slice() : privileges.privilegeList.slice(),
					fromCid: fromCid,
					toCid: toCid,
					group: group,
				}, next);
			},
			function (data, next) {
				if (group) {
					copyPrivilegesByGroup(data.privileges, data.fromCid, data.toCid, group, next);
				} else {
					copyPrivileges(data.privileges, data.fromCid, data.toCid, next);
				}
			},
		], callback);
	};

	function copyPrivileges(privileges, fromCid, toCid, callback) {
		const toGroups = privileges.map(privilege => 'group:cid:' + toCid + ':privileges:' + privilege + ':members');
		const fromGroups = privileges.map(privilege => 'group:cid:' + fromCid + ':privileges:' + privilege + ':members');
		async.waterfall([
			function (next) {
				db.getSortedSetsMembers(toGroups.concat(fromGroups), next);
			},
			function (currentMembers, next) {
				const copyGroups = _.uniq(_.flatten(currentMembers));
				async.each(copyGroups, function (group, next) {
					copyPrivilegesByGroup(privileges, fromCid, toCid, group, next);
				}, next);
			},
		], callback);
	}

	function copyPrivilegesByGroup(privileges, fromCid, toCid, group, callback) {
		async.waterfall([
			function (next) {
				const leaveGroups = privileges.map(privilege => 'cid:' + toCid + ':privileges:' + privilege);
				groups.leave(leaveGroups, group, next);
			},
			function (next) {
				const checkGroups = privileges.map(privilege => 'group:cid:' + fromCid + ':privileges:' + privilege + ':members');
				db.isMemberOfSortedSets(checkGroups, group, next);
			},
			function (isMembers, next) {
				privileges = privileges.filter((priv, index) => isMembers[index]);
				const joinGroups = privileges.map(privilege => 'cid:' + toCid + ':privileges:' + privilege);
				groups.join(joinGroups, group, next);
			},
		], callback);
	}
};
