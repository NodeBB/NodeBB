'use strict';

const validator = require('validator');

const user = require('../../user');
const groups = require('../../groups');
const events = require('../../events');
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
	await api.groups.delete(req, req.params);
	helpers.formatApiResponse(200, res);
};

Groups.join = async (req, res) => {
	await api.groups.join(req, req.params);
	helpers.formatApiResponse(200, res);
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
