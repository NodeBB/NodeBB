'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');
var groups = require('../groups');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');

module.exports = function(Categories) {

	Categories.create = function(data, callback) {
		var category;
		var parentCid = data.parentCid ? data.parentCid : 0;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextCid', next);
			},
			function(cid, next) {
				data.name = data.name || 'Category ' + cid;
				var slug = cid + '/' + utils.slugify(data.name);
				var order = data.order || cid;	// If no order provided, place it at the end
				var colours = Categories.assignColours();

				category = {
					cid: cid,
					name: data.name,
					description: data.description ? data.description : '',
					icon: data.icon ? data.icon : '',
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
					imageClass: 'cover'
				};

				plugins.fireHook('filter:category.create', {category: category, data: data}, next);
			},
			function(data, next) {
				category = data.category;

				var defaultPrivileges = ['find', 'read', 'topics:create', 'topics:reply'];

				async.series([
					async.apply(db.setObject, 'category:' + category.cid, category),
					async.apply(Categories.parseDescription, category.cid, category.description),
					async.apply(db.sortedSetAdd, 'categories:cid', category.order, category.cid),
					async.apply(db.sortedSetAdd, 'cid:' + parentCid + ':children', category.order, category.cid),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'administrators'),
					async.apply(privileges.categories.give, defaultPrivileges, category.cid, 'registered-users'),
					async.apply(privileges.categories.give, ['find', 'read'], category.cid, 'guests')
				], next);
			},
			function(results, next) {
				if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
					return Categories.copySettingsFrom(data.cloneFromCid, category.cid, next);
				}
				next(null, category);
			},
			function(category, next) {
				plugins.fireHook('action:category.create', category);
				next(null, category);
			}
		], callback);
	};

	Categories.assignColours = function() {
		var backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
		var text = ['#fff', '#fff', '#333', '#fff', '#333', '#fff', '#fff', '#fff'];
		var index = Math.floor(Math.random() * backgrounds.length);

		return [backgrounds[index], text[index]];
	};

	Categories.copySettingsFrom = function(fromCid, toCid, callback) {
		var destination;
		async.waterfall([
			function (next) {
				async.parallel({
					source: async.apply(db.getObject, 'category:' + fromCid),
					destination: async.apply(db.getObject, 'category:' + toCid)
				}, next);
			},
			function (results, next) {
				if (!results.source) {
					return next(new Error('[[error:invalid-cid]]'));
				}
				destination = results.destination;

				var tasks = [];
				if (utils.isNumber(results.source.parentCid)) {
					tasks.push(async.apply(db.sortedSetAdd, 'cid:' + results.source.parentCid + ':children', results.source.order, toCid));
				}

				if (destination && utils.isNumber(destination.parentCid)) {
					tasks.push(async.apply(db.sortedSetRemove, 'cid:' + destination.parentCid + ':children', toCid));
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
				destination.parentCid = results.source.parentCid || 0;

				tasks.push(async.apply(db.setObject, 'category:' + toCid, destination));

				async.series(tasks, next);
			},
			function (results, next) {
				Categories.copyPrivilegesFrom(fromCid, toCid, next);
			}
		], function(err) {
			callback(err, destination);
		});
	};

	Categories.copyPrivilegesFrom = function(fromCid, toCid, callback) {
		var privilegeList = [
			'find', 'read', 'topics:create', 'topics:reply', 'purge', 'mods',
			'groups:find', 'groups:read', 'groups:topics:create', 'groups:topics:reply', 'groups:purge', 'groups:moderate'
		];

		async.each(privilegeList, function(privilege, next) {
			copyPrivilege(privilege, fromCid, toCid, next);
		}, callback);
	};

	function copyPrivilege(privilege, fromCid, toCid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('group:cid:' + toCid + ':privileges:' + privilege + ':members', 0, -1, next);
			},
			function (currentMembers, next) {
				async.eachSeries(currentMembers, function(member, next) {
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

				async.eachSeries(members, function(member, next) {
					groups.join('cid:' + toCid + ':privileges:' + privilege, member, next);
				}, next);
			}
		], callback);
	}

};
