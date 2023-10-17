'use strict';

const async = require('async');
const _ = require('lodash');

const db = require('../database');
const plugins = require('../plugins');
const privileges = require('../privileges');
const utils = require('../utils');
const slugify = require('../slugify');
const cache = require('../cache');

module.exports = function (Categories) {
	Categories.create = async function (data) {
		const parentCid = data.parentCid ? data.parentCid : 0;
		const [cid, firstChild] = await Promise.all([
			db.incrObjectField('global', 'nextCid'),
			db.getSortedSetRangeWithScores(`cid:${parentCid}:children`, 0, 0),
		]);

		data.name = String(data.name || `Category ${cid}`);
		const slug = `${cid}/${slugify(data.name)}`;
		const smallestOrder = firstChild.length ? firstChild[0].score - 1 : 1;
		const order = data.order || smallestOrder; // If no order provided, place it at the top
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
			class: (data.class ? data.class : 'col-md-3 col-6'),
			imageClass: 'cover',
			isSection: 0,
			subCategoriesPerPage: 10,
		};

		if (data.backgroundImage) {
			category.backgroundImage = data.backgroundImage;
		}

		const defaultPrivileges = [
			'groups:find',
			'groups:read',
			'groups:topics:read',
			'groups:topics:create',
			'groups:topics:reply',
			'groups:topics:tag',
			'groups:posts:edit',
			'groups:posts:history',
			'groups:posts:delete',
			'groups:posts:upvote',
			'groups:posts:downvote',
			'groups:topics:delete',
		];
		const modPrivileges = defaultPrivileges.concat([
			'groups:topics:schedule',
			'groups:posts:view_deleted',
			'groups:purge',
		]);
		const guestPrivileges = ['groups:find', 'groups:read', 'groups:topics:read'];

		const result = await plugins.hooks.fire('filter:category.create', {
			category: category,
			data: data,
			defaultPrivileges: defaultPrivileges,
			modPrivileges: modPrivileges,
			guestPrivileges: guestPrivileges,
		});
		category = result.category;

		await db.setObject(`category:${category.cid}`, category);
		if (!category.descriptionParsed) {
			await Categories.parseDescription(category.cid, category.description);
		}

		await db.sortedSetAddBulk([
			['categories:cid', category.order, category.cid],
			[`cid:${parentCid}:children`, category.order, category.cid],
			['categories:name', 0, `${data.name.slice(0, 200).toLowerCase()}:${category.cid}`],
		]);

		await privileges.categories.give(result.defaultPrivileges, category.cid, 'registered-users');
		await privileges.categories.give(result.modPrivileges, category.cid, ['administrators', 'Global Moderators']);
		await privileges.categories.give(result.guestPrivileges, category.cid, ['guests', 'spiders']);

		cache.del('categories:cid');
		await clearParentCategoryCache(parentCid);

		if (data.cloneFromCid && parseInt(data.cloneFromCid, 10)) {
			category = await Categories.copySettingsFrom(data.cloneFromCid, category.cid, !data.parentCid);
		}

		if (data.cloneChildren) {
			await duplicateCategoriesChildren(category.cid, data.cloneFromCid, data.uid);
		}

		plugins.hooks.fire('action:category.create', { category: category });
		return category;
	};

	async function clearParentCategoryCache(parentCid) {
		while (parseInt(parentCid, 10) >= 0) {
			cache.del([
				`cid:${parentCid}:children`,
				`cid:${parentCid}:children:all`,
			]);

			if (parseInt(parentCid, 10) === 0) {
				return;
			}
			// clear all the way to root
			// eslint-disable-next-line no-await-in-loop
			parentCid = await Categories.getCategoryField(parentCid, 'parentCid');
		}
	}

	async function duplicateCategoriesChildren(parentCid, cid, uid) {
		let children = await Categories.getChildren([cid], uid);
		if (!children.length) {
			return;
		}

		children = children[0];

		children.forEach((child) => {
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
		const backgrounds = ['#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
		const text = ['#ffffff', '#ffffff', '#333333', '#ffffff', '#333333', '#ffffff', '#ffffff', '#ffffff'];
		const index = Math.floor(Math.random() * backgrounds.length);
		return [backgrounds[index], text[index]];
	};

	Categories.copySettingsFrom = async function (fromCid, toCid, copyParent) {
		const [source, destination] = await Promise.all([
			db.getObject(`category:${fromCid}`),
			db.getObject(`category:${toCid}`),
		]);
		if (!source) {
			throw new Error('[[error:invalid-cid]]');
		}

		const oldParent = parseInt(destination.parentCid, 10) || 0;
		const newParent = parseInt(source.parentCid, 10) || 0;
		if (copyParent && newParent !== parseInt(toCid, 10)) {
			await db.sortedSetRemove(`cid:${oldParent}:children`, toCid);
			await db.sortedSetAdd(`cid:${newParent}:children`, source.order, toCid);
			cache.del([
				`cid:${oldParent}:children`,
				`cid:${oldParent}:children:all`,
				`cid:${newParent}:children`,
				`cid:${newParent}:children:all`,
			]);
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
		destination.minTags = source.minTags;
		destination.maxTags = source.maxTags;

		if (copyParent) {
			destination.parentCid = source.parentCid || 0;
		}
		await plugins.hooks.fire('filter:categories.copySettingsFrom', {
			source: source,
			destination: destination,
			copyParent: copyParent,
		});

		await db.setObject(`category:${toCid}`, destination);

		await copyTagWhitelist(fromCid, toCid);

		await Categories.copyPrivilegesFrom(fromCid, toCid);

		return destination;
	};

	async function copyTagWhitelist(fromCid, toCid) {
		const data = await db.getSortedSetRangeWithScores(`cid:${fromCid}:tag:whitelist`, 0, -1);
		await db.delete(`cid:${toCid}:tag:whitelist`);
		await db.sortedSetAdd(`cid:${toCid}:tag:whitelist`, data.map(item => item.score), data.map(item => item.value));
		cache.del(`cid:${toCid}:tag:whitelist`);
	}

	Categories.copyPrivilegesFrom = async function (fromCid, toCid, group, filter) {
		group = group || '';
		let privsToCopy = privileges.categories.getPrivilegesByFilter(filter);

		if (group) {
			privsToCopy = privsToCopy.map(priv => `groups:${priv}`);
		} else {
			privsToCopy = privsToCopy.concat(privsToCopy.map(priv => `groups:${priv}`));
		}

		const data = await plugins.hooks.fire('filter:categories.copyPrivilegesFrom', {
			privileges: privsToCopy,
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
		const toGroups = privileges.map(privilege => `group:cid:${toCid}:privileges:${privilege}:members`);
		const fromGroups = privileges.map(privilege => `group:cid:${fromCid}:privileges:${privilege}:members`);

		const currentMembers = await db.getSortedSetsMembers(toGroups.concat(fromGroups));
		const copyGroups = _.uniq(_.flatten(currentMembers));
		await async.each(copyGroups, async (group) => {
			await copyPrivilegesByGroup(privileges, fromCid, toCid, group);
		});
	}

	async function copyPrivilegesByGroup(privilegeList, fromCid, toCid, group) {
		const fromGroups = privilegeList.map(privilege => `group:cid:${fromCid}:privileges:${privilege}:members`);
		const toGroups = privilegeList.map(privilege => `group:cid:${toCid}:privileges:${privilege}:members`);
		const [fromChecks, toChecks] = await Promise.all([
			db.isMemberOfSortedSets(fromGroups, group),
			db.isMemberOfSortedSets(toGroups, group),
		]);
		const givePrivs = privilegeList.filter((priv, index) => fromChecks[index] && !toChecks[index]);
		const rescindPrivs = privilegeList.filter((priv, index) => !fromChecks[index] && toChecks[index]);
		await privileges.categories.give(givePrivs, toCid, group);
		await privileges.categories.rescind(rescindPrivs, toCid, group);
	}
};
