'use strict';

var async = require('async'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	db = require('../database');

module.exports = function(Groups) {

	Groups.create = function(data, callback) {
		var system = data.name === 'administrators' || data.name === 'registered-users' || Groups.isPrivilegeGroup(data.name);
		var groupData;
		var timestamp = data.timestamp || Date.now();

		async.waterfall([
			function (next) {
				validateGroupName(data.name, next);
			},
			function (next) {
				meta.userOrGroupExists(data.name, next);
			},
			function (exists, next) {
				if (exists) {
					return next(new Error('[[error:group-already-exists]]'));
				}

				var memberCount = data.hasOwnProperty('ownerUid') ? 1 : 0;
				var slug = utils.slugify(data.name);
				groupData = {
					name: data.name,
					slug: slug,
					createtime: timestamp,
					userTitle: data.name,
					description: data.description || '',
					memberCount: memberCount,
					deleted: '0',
					hidden: data.hidden || '0',
					system: system ? '1' : '0',
					private: data.private || '1'
				};
				plugins.fireHook('filter:group.create', {group: groupData, data: data}, next);
			},
			function (results, next) {
				var tasks = [
					async.apply(db.sortedSetAdd, 'groups:createtime', groupData.createtime, groupData.name),
					async.apply(db.setObject, 'group:' + groupData.name, groupData)
				];

				if (data.hasOwnProperty('ownerUid')) {
					tasks.push(async.apply(db.setAdd, 'group:' + groupData.name + ':owners', data.ownerUid));
					tasks.push(async.apply(db.sortedSetAdd, 'group:' + groupData.name + ':members', timestamp, data.ownerUid));

					groupData.ownerUid = data.ownerUid;
				}

				if (!data.hidden && !system) {
					tasks.push(async.apply(db.sortedSetAdd, 'groups:visible:createtime', timestamp, groupData.name));
					tasks.push(async.apply(db.sortedSetAdd, 'groups:visible:memberCount', groupData.memberCount, groupData.name));
					tasks.push(async.apply(db.sortedSetAdd, 'groups:visible:name', 0, groupData.name.toLowerCase() + ':' + groupData.name));
				}

				tasks.push(async.apply(db.setObjectField, 'groupslug:groupname', groupData.slug, groupData.name));

				async.series(tasks, next);
			},
			function (results, next) {
				plugins.fireHook('action:group.create', groupData);
				next(null, groupData);
			}
		], callback);

	};

	function validateGroupName(name, callback) {
		if (!name) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (name.indexOf('/') !== -1) {
			return callback(new Error('[[error:invalid-group-name]]'));
		}
	}
};
