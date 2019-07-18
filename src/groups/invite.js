'use strict';

const db = require('../database');
const user = require('../user');
const utils = require('../utils');
const plugins = require('../plugins');
const notifications = require('../notifications');

module.exports = function (Groups) {
	Groups.requestMembership = async function (groupName, uid) {
		await inviteOrRequestMembership(groupName, uid, 'request');
		const username = await user.getUserField(uid, 'username');
		const [notification, owners] = await Promise.all([
			notifications.create({
				type: 'group-request-membership',
				bodyShort: '[[groups:request.notification_title, ' + username + ']]',
				bodyLong: '[[groups:request.notification_text, ' + username + ', ' + groupName + ']]',
				nid: 'group:' + groupName + ':uid:' + uid + ':request',
				path: '/groups/' + utils.slugify(groupName),
				from: uid,
			}),
			Groups.getOwners(groupName),
		]);

		await notifications.push(notification, owners);
	};

	Groups.acceptMembership = async function (groupName, uid) {
		await db.setsRemove(['group:' + groupName + ':pending', 'group:' + groupName + ':invited'], uid);
		await Groups.join(groupName, uid);
	};

	Groups.rejectMembership = async function (groupNames, uid) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		const sets = [];
		groupNames.forEach(function (groupName) {
			sets.push('group:' + groupName + ':pending', 'group:' + groupName + ':invited');
		});
		await db.setsRemove(sets, uid);
	};

	Groups.invite = async function (groupName, uid) {
		await inviteOrRequestMembership(groupName, uid, 'invite');
		const notification = await notifications.create({
			type: 'group-invite',
			bodyShort: '[[groups:invited.notification_title, ' + groupName + ']]',
			bodyLong: '',
			nid: 'group:' + groupName + ':uid:' + uid + ':invite',
			path: '/groups/' + utils.slugify(groupName),
		});
		await notifications.push(notification, [uid]);
	};

	async function inviteOrRequestMembership(groupName, uid, type) {
		if (!(parseInt(uid, 10) > 0)) {
			throw new Error('[[error:not-logged-in]]');
		}

		const [exists, isMember, isPending, isInvited] = await Promise.all([
			Groups.exists(groupName),
			Groups.isMember(uid, groupName),
			Groups.isPending(uid, groupName),
			Groups.isInvited(uid, groupName),
		]);

		if (!exists) {
			throw new Error('[[error:no-group]]');
		} else if (isMember || (type === 'invite' && isInvited)) {
			return;
		} else if (type === 'request' && isPending) {
			throw new Error('[[error:group-already-requested]]');
		}

		const set = type === 'invite' ? 'group:' + groupName + ':invited' : 'group:' + groupName + ':pending';
		await db.setAdd(set, uid);
		const hookName = type === 'invite' ? 'action:group.inviteMember' : 'action:group.requestMembership';
		plugins.fireHook(hookName, {
			groupName: groupName,
			uid: uid,
		});
	}

	Groups.isInvited = async function (uid, groupName) {
		if (!(parseInt(uid, 10) > 0)) {
			return false;
		}
		return await db.isSetMember('group:' + groupName + ':invited', uid);
	};

	Groups.isPending = async function (uid, groupName) {
		if (!(parseInt(uid, 10) > 0)) {
			return false;
		}
		return await db.isSetMember('group:' + groupName + ':pending', uid);
	};

	Groups.getPending = async function (groupName) {
		if (!groupName) {
			return [];
		}
		return await db.getSetMembers('group:' + groupName + ':pending');
	};
};
