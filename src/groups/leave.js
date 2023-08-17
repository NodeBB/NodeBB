'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const plugins = require('../plugins');
const cache = require('../cache');
const messaging = require('../messaging');

module.exports = function (Groups) {
	Groups.leave = async function (groupNames, uid) {
		if (Array.isArray(groupNames) && !groupNames.length) {
			return;
		}
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}

		const isMembers = await Groups.isMemberOfGroups(uid, groupNames);

		const groupsToLeave = groupNames.filter((groupName, index) => isMembers[index]);
		if (!groupsToLeave.length) {
			return;
		}

		await Promise.all([
			db.sortedSetRemove(groupsToLeave.map(groupName => `group:${groupName}:members`), uid),
			db.setRemove(groupsToLeave.map(groupName => `group:${groupName}:owners`), uid),
			db.decrObjectField(groupsToLeave.map(groupName => `group:${groupName}`), 'memberCount'),
		]);

		Groups.clearCache(uid, groupsToLeave);
		cache.del(groupsToLeave.map(name => `group:${name}:members`));

		const groupData = await Groups.getGroupsFields(groupsToLeave, ['name', 'hidden', 'memberCount']);
		if (!groupData) {
			return;
		}

		const emptyPrivilegeGroups = groupData.filter(g => g && Groups.isPrivilegeGroup(g.name) && g.memberCount === 0);
		const visibleGroups = groupData.filter(g => g && !g.hidden);

		const promises = [];
		if (emptyPrivilegeGroups.length) {
			promises.push(Groups.destroy, emptyPrivilegeGroups);
		}
		if (visibleGroups.length) {
			promises.push(
				db.sortedSetAdd,
				'groups:visible:memberCount',
				visibleGroups.map(groupData => groupData.memberCount),
				visibleGroups.map(groupData => groupData.name)
			);
		}

		await Promise.all(promises);

		await Promise.all([
			clearGroupTitleIfSet(groupsToLeave, uid),
			leavePublicRooms(groupsToLeave, uid),
		]);

		plugins.hooks.fire('action:group.leave', {
			groupNames: groupsToLeave,
			uid: uid,
		});
	};

	async function leavePublicRooms(groupNames, uid) {
		const allRoomIds = await messaging.getPublicRoomIdsFromSet('chat:rooms:public:order');
		const allRoomData = await messaging.getRoomsData(allRoomIds);
		const roomData = allRoomData.filter(
			room => room && room.groups.some(group => groupNames.includes(group))
		);
		const isMemberOfAny = _.zipObject(
			roomData.map(r => r.roomId),
			await Promise.all(roomData.map(r => Groups.isMemberOfAny(uid, r.groups)))
		);
		const roomIds = roomData.filter(r => isMemberOfAny[r.roomId]).map(r => r.roomId);
		await messaging.leaveRooms(uid, roomIds);
	}

	async function clearGroupTitleIfSet(groupNames, uid) {
		groupNames = groupNames.filter(groupName => groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName));
		if (!groupNames.length) {
			return;
		}
		const userData = await user.getUserData(uid);
		if (!userData) {
			return;
		}

		const newTitleArray = userData.groupTitleArray.filter(groupTitle => !groupNames.includes(groupTitle));
		if (newTitleArray.length) {
			await db.setObjectField(`user:${uid}`, 'groupTitle', JSON.stringify(newTitleArray));
		} else {
			await db.deleteObjectField(`user:${uid}`, 'groupTitle');
		}
	}

	Groups.leaveAllGroups = async function (uid) {
		const groups = await db.getSortedSetRange('groups:createtime', 0, -1);
		await Promise.all([
			Groups.leave(groups, uid),
			Groups.rejectMembership(groups, uid),
		]);
	};

	Groups.kick = async function (uid, groupName, isOwner) {
		if (isOwner) {
			// If the owners set only contains one member, error out!
			const numOwners = await db.setCount(`group:${groupName}:owners`);
			if (numOwners <= 1) {
				throw new Error('[[error:group-needs-owner]]');
			}
		}
		await Groups.leave(groupName, uid);
	};
};
