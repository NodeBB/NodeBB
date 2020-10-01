'use strict';

const user = require('../../user');
const groups = require('../../groups');
const events = require('../../events');
const meta = require('../../meta');

const helpers = require('../helpers');

const Groups = module.exports;

Groups.create = async (req, res) => {
	if (typeof req.body.name !== 'string' || groups.isPrivilegeGroup(req.body.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	if (!res.locals.privileges['group:create']) {
		throw new Error('[[error:no-privileges]]');
	}

	req.body.ownerUid = req.user.uid;
	req.body.system = false;

	const groupObj = await groups.create(req.body);
	helpers.formatApiResponse(200, res, groupObj);
	logGroupEvent(req, 'group-create', {
		groupName: req.body.name,
	});
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
		user.exists(req.user.uid),
	]);

	if (group.isMember) {
		// No change
		return helpers.formatApiResponse(200, res);
	} else if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	// console.log(res.locals.privileges);
	// return res.sendStatus(200);

	if (!res.locals.privileges.isAdmin) {
		// Admin and privilege groups unjoinable client-side
		if (group.name === 'administrators' || groups.isPrivilegeGroup(group.name)) {
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

function logGroupEvent(req, event, additional) {
	events.log({
		type: event,
		uid: req.user.uid,
		ip: req.ip,
		...additional,
	});
}
