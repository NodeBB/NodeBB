'use strict';

var async = require('async'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	db = require('./../database');

module.exports = function(Groups) {
	Groups.create = function(data, callback) {
		if (data.name.length === 0) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		var system = data.name === 'administrators' || data.name === 'registered-users' || Groups.isPrivilegeGroup(data.name);

		meta.userOrGroupExists(data.name, function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:group-already-exists]]'));
			}
			var timestamp = data.timestamp || Date.now();

			var slug = utils.slugify(data.name),
				groupData = {
					name: data.name,
					slug: slug,
					createtime: timestamp,
					userTitle: data.name,
					description: data.description || '',
					memberCount: 0,
					deleted: '0',
					hidden: data.hidden || '0',
					system: system ? '1' : '0',
					private: data.private || '1'
				},
				tasks = [
					async.apply(db.sortedSetAdd, 'groups:createtime', timestamp, data.name),
					async.apply(db.setObject, 'group:' + data.name, groupData)
				];

			if (data.hasOwnProperty('ownerUid')) {
				tasks.push(async.apply(db.setAdd, 'group:' + data.name + ':owners', data.ownerUid));
				tasks.push(async.apply(db.sortedSetAdd, 'group:' + data.name + ':members', timestamp, data.ownerUid));
				tasks.push(async.apply(db.setObjectField, 'group:' + data.name, 'memberCount', 1));

				groupData.ownerUid = data.ownerUid;
			}

			if (!data.hidden) {
				tasks.push(async.apply(db.setObjectField, 'groupslug:groupname', slug, data.name));
			}

			async.series(tasks, function(err) {
				if (!err) {
					plugins.fireHook('action:group.create', groupData);
				}

				callback(err, groupData);
			});
		});
	};
};
