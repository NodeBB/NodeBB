'use strict';

const validator = require('validator');

const user = require('../../user');
const groups = require('../../groups');
const events = require('../../events');
const meta = require('../../meta');
const slugify = require('../../slugify');
const notifications = require('../../notifications');
const api = require('../../api');

const helpers = require('../helpers');

const Groups = module.exports;

Groups.create = async (req, res) => {
	const groupObj = await api.groups.create(req, req.body);
	helpers.formatApiResponse(200, res, groupObj);
};

Groups.delete = async (req, res) => {
	const group = await groups.getByGroupslug(req.params.slug, {
		uid: req.user.uid,
	});

	if (groups.ephemeralGroups.includes(group.slug)) {
		throw new Error('[[error:not-allowed]]');
	}

	if (group.system || (!group.isOwner && !res.locals.privileges.isAdmin && !res.locals.privileges.isGmod)) {
		throw new Error('[[error:no-privileges]]');
	}

	await groups.destroy(group.name);
	helpers.formatApiResponse(200, res);
	logGroupEvent(req, 'group-delete', {
		groupName: group.name,
	});
};

Groups.join = async (req, res) => {
	const group = await groups.getByGroupslug(req.params.slug, {
		uid: req.params.uid,
	});
	const [isCallerOwner, userExists] = await Promise.all([
		groups.ownership.isOwner(req.user.uid, group.name),
		user.exists(req.params.uid),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	} else if (group.isMember) {
		// No change
		return helpers.formatApiResponse(200, res);
	}

	if (!res.locals.privileges.isAdmin) {
		// Admin and privilege groups unjoinable client-side
		if (groups.systemGroups.includes(group.name) || groups.isPrivilegeGroup(group.name)) {
			throw new Error('[[error:not-allowed]]');
		}

		if (!isCallerOwner && parseInt(meta.config.allowPrivateGroups, 10) !== 0 && group.private) {
			await groups.requestMembership(group.name, req.params.uid);
		} else {
			await groups.join(group.name, req.params.uid);
		}
	} else {
		await groups.join(group.name, req.params.uid);
	}

	helpers.formatApiResponse(200, res);
	logGroupEvent(req, 'group-join', {
		groupName: group.name,
	});
};

Groups.leave = async (req, res) => {
	const [group, userExists] = await Promise.all([
		groups.getByGroupslug(req.params.slug, {
			uid: req.params.uid,
		}),
		user.exists(req.params.uid),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	} else if (group.disableLeave) {
		throw new Error('[[error:group-leave-disabled]]');
	} else if (!group.isMember) {
		// No change
		return helpers.formatApiResponse(200, res);
	}

	await groups.leave(group.name, req.params.uid);

	// Notify owners of user having left
	const username = await user.getUserField(req.params.uid, 'username');
	const notification = await notifications.create({
		type: 'group-leave',
		bodyShort: '[[groups:membership.leave.notification_title, ' + username + ', ' + group.name + ']]',
		nid: 'group:' + validator.escape(group.name) + ':uid:' + req.params.uid + ':group-leave',
		path: '/groups/' + slugify(group.name),
	});
	const uids = await groups.getOwners(group.name);
	await notifications.push(notification, uids);

	helpers.formatApiResponse(200, res);
	logGroupEvent(req, 'group-leave', {
		groupName: group.name,
	});
};

function logGroupEvent(req, event, additional) {
	events.log({
		type: event,
		uid: req.user.uid,
		ip: req.ip,
		...additional,
	});
}
