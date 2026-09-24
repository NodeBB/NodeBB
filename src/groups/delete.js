'use strict';

const _ = require('lodash');

const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');
const batch = require('../batch');
const cache = require('../cache');

module.exports = function (Groups) {
	Groups.destroy = async function (groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}

		let groupsData = await Groups.getGroupsData(groupNames);
		groupsData = groupsData.filter(Boolean);
		if (!groupsData.length) {
			return;
		}
		const keys = [];
		groupNames.forEach((groupName) => {
			keys.push(
				`group:${groupName}`,
				`group:${groupName}:members`,
				`group:${groupName}:pending`,
				`group:${groupName}:invited`,
				`group:${groupName}:owners`,
				`group:${groupName}:member:pids`,
				`group:${groupName}:editor:pids`,
				`group:${groupName}:chat:rooms`
			);
		});
		const sets = groupNames.map(groupName => `${groupName.toLowerCase()}:${groupName}`);
		const groupSlugs = groupNames
			.filter(groupName => !Groups.isPrivilegeGroup(groupName))
			.map(groupName => slugify(groupName));

		await removeGroupsFromPrivilegeGroups(groupNames);
		await removeGroupsFromPostEditors(groupNames);
		await removeGroupsFromMemberGroupRooms(groupNames);
		await Promise.all([
			db.deleteAll(keys),
			db.sortedSetRemove([
				'groups:createtime',
				'groups:visible:createtime',
				'groups:visible:memberCount',
				'groups:chatContactable',
			], groupNames),
			db.sortedSetRemove('groups:visible:name', sets),
			db.deleteObjectFields('groupslug:groupname', groupSlugs),
		]);
		Groups.cache.reset();
		cache.del([
			`zset:groups:createtime`,
			...groupNames.map(groupName => `group:${groupName}:members`),
		]);
		await removeGroupsFromPublicRooms(groupNames);
		plugins.hooks.fire('action:groups.destroy', { groups: groupsData });
	};

	async function removeGroupsFromPublicRooms(groupNames) {
		const messaging = require('../messaging');
		const roomIds = await db.getSortedSetRange('chat:rooms:public', 0, -1);
		const roomData = (await messaging.getRoomsData(roomIds)).filter(
			room => room && Array.isArray(room.groups) && room.groups.some(group => groupNames.includes(group))
		);
		await Promise.all(roomData.map(async (room) => {
			const groups = room.groups.filter(group => !groupNames.includes(group));
			if (!groups.length) {
				groups.push('administrators');
			}
			await db.setObjectField(`chat:room:${room.roomId}`, 'groups', JSON.stringify(groups));

			const uids = await messaging.getUidsInRoom(room.roomId, 0, -1);
			const [isMembers, isAdmins] = await Promise.all([
				Promise.all(uids.map(uid => Groups.isMemberOfAny(uid, groups))),
				Groups.isMembers(uids, 'administrators'),
			]);
			const uidsToRemove = uids.filter((uid, index) => !isMembers[index] && !isAdmins[index]);
			if (uidsToRemove.length) {
				await messaging.leaveRoom(uidsToRemove, room.roomId);
			}
		}));
	}

	async function removeGroupsFromMemberGroupRooms(groupNames) {
		const messaging = require('../messaging');
		const roomIds = await db.getSortedSetsMembers(groupNames.map(groupName => `group:${groupName}:chat:rooms`));
		await Promise.all(_.uniq(roomIds.flat()).map(roomId => messaging.removeMemberGroups(roomId, groupNames)));
	}

	async function removeGroupsFromPostEditors(groupNames) {
		await Promise.all(groupNames.map(
			groupName => batch.processSortedSet(`group:${groupName}:editor:pids`, async (pids) => {
				await db.setsRemove(pids.map(pid => `pid:${pid}:editors:groups`), groupName);
			}, { batch: 500 })
		));
	}

	async function removeGroupsFromPrivilegeGroups(groupNames) {
		await batch.processSortedSet('groups:createtime', async (otherGroups) => {
			const privilegeGroups = otherGroups.filter(Groups.isPrivilegeGroup);
			const keys = privilegeGroups.map(group => `group:${group}:members`);
			await db.sortedSetRemove(keys, groupNames);
			cache.del(keys);
		}, {
			batch: 500,
		});
	}
};
