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
	Categories.create = async function (data) {
		const parentCid = data.parentCid ? data.parentCid : 0;
		const cid = await db.incrObjectField('global', 'nextCid');

		data.name = data.name || 'Category ' + cid;
		const slug = cid + '/' + utils.slugify(data.name);
		const order = data.order || cid;	// If no order provided, place it at the end
		const colours = Categories.assignColours();

		let category = {
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

		const result = await plugins.fireHook('filter:category.create', { category: category, data: data });
		category = result.category;

		const defaultPrivileges = [
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

		await db.setObject('category:' + category.cid, category);
		if (!category.descriptionParsed) {
			await Categories.parseDescription(category.cid, category.description);
		}
		await db.sortedSetsAdd(['categories:cid', 'cid:' + parentCid + ':children'], category.order, category.cid);
		await privileges.categories.give(defaultPrivileges, category.cid, 'registered-users');
		await privileges.categories.give(modPrivileges, category.cid, ['administrators', 'Global Moderators']);
		await privileges.categories.give(['find', 'read', 'topics:read'], category.cid, ['guests', 'spiders']);

		cache.del(['categories:cid', 'cid:' + parentCid + ':children']);
		if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
			category = await Categories.copySettingsFrom(data.cloneFromCid, category.cid, !data.parentCid);
		}

		if (data.cloneChildren) {
			await duplicateCategoriesChildren(category.cid, data.cloneFromCid, data.uid);
		}

		plugins.fireHook('action:category.create', { category: category });
		return category;
	};

	async function duplicateCategoriesChildren(parentCid, cid, uid) {
		let children = await Categories.getChildren([cid], uid);
		if (!children.length) {
			return;
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

		await async.each(children, Categories.create);
	}

	Categories.assignColours = function () {
		var backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
		var text = ['#fff', '#fff', '#333', '#fff', '#333', '#fff', '#fff', '#fff'];
		var index = Math.floor(Math.random() * backgrounds.length);

		return [backgrounds[index], text[index]];
	};

	Categories.copySettingsFrom = async function (fromCid, toCid, copyParent) {
		const [source, destination] = await Promise.all([
			db.getObject('category:' + fromCid),
			db.getObject('category:' + toCid),
		]);
		if (!source) {
			throw new Error('[[error:invalid-cid]]');
		}

		const oldParent = parseInt(destination.parentCid, 10) || 0;
		const newParent = parseInt(source.parentCid, 10) || 0;
		if (copyParent && newParent !== parseInt(toCid, 10)) {
			await db.sortedSetRemove('cid:' + oldParent + ':children', toCid);
			await db.sortedSetAdd('cid:' + newParent + ':children', source.order, toCid);
			cache.del(['cid:' + oldParent + ':children', 'cid:' + newParent + ':children']);
		}

		destination.description = source.description;
		destination.descriptionParsed = source.descriptionParsed;
		destination.icon = source.icon;
		destination.bgColor = source.bgColor;
		destination.color = source.color;
		destination.link = source.link;
		destination.numRecentReplies = source.numRecentReplies;
		destination.class = source.class;
		destination.image = source.image;
		destination.imageClass = source.imageClass;

		if (copyParent) {
			destination.parentCid = source.parentCid || 0;
		}

		await db.setObject('category:' + toCid, destination);

		await copyTagWhitelist(fromCid, toCid);

		await Categories.copyPrivilegesFrom(fromCid, toCid);

		return destination;
	};

	async function copyTagWhitelist(fromCid, toCid) {
		const data = await db.getSortedSetRangeWithScores('cid:' + fromCid + ':tag:whitelist', 0, -1);
		await db.delete('cid:' + toCid + ':tag:whitelist');
		await db.sortedSetAdd('cid:' + toCid + ':tag:whitelist', data.map(item => item.score), data.map(item => item.value));
		cache.del('cid:' + toCid + ':tag:whitelist');
	}

	Categories.copyPrivilegesFrom = async function (fromCid, toCid, group) {
		group = group || '';

		const data = await plugins.fireHook('filter:categories.copyPrivilegesFrom', {
			privileges: group ? privileges.groupPrivilegeList.slice() : privileges.privilegeList.slice(),
			fromCid: fromCid,
			toCid: toCid,
			group: group,
		});
		if (group) {
			await copyPrivilegesByGroup(data.privileges, data.fromCid, data.toCid, group);
		} else {
			await copyPrivileges(data.privileges, data.fromCid, data.toCid);
		}
	};

	async function copyPrivileges(privileges, fromCid, toCid) {
		const toGroups = privileges.map(privilege => 'group:cid:' + toCid + ':privileges:' + privilege + ':members');
		const fromGroups = privileges.map(privilege => 'group:cid:' + fromCid + ':privileges:' + privilege + ':members');

		const currentMembers = await db.getSortedSetsMembers(toGroups.concat(fromGroups));
		const copyGroups = _.uniq(_.flatten(currentMembers));
		await async.each(copyGroups, async function (group) {
			await copyPrivilegesByGroup(privileges, fromCid, toCid, group);
		});
	}

	async function copyPrivilegesByGroup(privileges, fromCid, toCid, group) {
		const leaveGroups = privileges.map(privilege => 'cid:' + toCid + ':privileges:' + privilege);
		await groups.leave(leaveGroups, group);

		const checkGroups = privileges.map(privilege => 'group:cid:' + fromCid + ':privileges:' + privilege + ':members');
		const isMembers = await db.isMemberOfSortedSets(checkGroups, group);
		privileges = privileges.filter((priv, index) => isMembers[index]);
		const joinGroups = privileges.map(privilege => 'cid:' + toCid + ':privileges:' + privilege);
		await groups.join(joinGroups, group);
	}
};
