// SPDX-FileCopyrightText: 2013-2021 NodeBB Inc
//
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const db = require('../database');
const plugins = require('../plugins');
const utils = require('../utils');

module.exports = function (Groups) {
	Groups.ownership = {};

	Groups.ownership.isOwner = async function (uid, groupName) {
		if (!(parseInt(uid, 10) > 0)) {
			return false;
		}
		return await db.isSetMember(`group:${groupName}:owners`, uid);
	};

	Groups.ownership.isOwners = async function (uids, groupName) {
		if (!Array.isArray(uids)) {
			return [];
		}

		return await db.isSetMembers(`group:${groupName}:owners`, uids);
	};

	Groups.ownership.grant = async function (toUid, groupName) {
		if (!utils.isNumber(toUid)) {
			throw new Error('[[error:invalid-uid]]');
		}

		await db.setAdd(`group:${groupName}:owners`, toUid);
		plugins.hooks.fire('action:group.grantOwnership', { uid: toUid, groupName: groupName });
	};

	Groups.ownership.rescind = async function (toUid, groupName) {
		if (!utils.isNumber(toUid)) {
			throw new Error('[[error:invalid-uid]]');
		}

		// If the owners set only contains one member (and toUid is that member), error out!
		const [numOwners, isOwner] = await Promise.all([
			db.setCount(`group:${groupName}:owners`),
			db.isSetMember(`group:${groupName}:owners`, toUid),
		]);
		if (numOwners <= 1 && isOwner) {
			throw new Error('[[error:group-needs-owner]]');
		}
		await db.setRemove(`group:${groupName}:owners`, toUid);
		plugins.hooks.fire('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
	};
};
