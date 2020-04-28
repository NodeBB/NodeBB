'use strict';

const groups = require('../../groups');
const events = require('../../events');

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

function logGroupEvent(req, event, additional) {
	events.log({
		type: event,
		uid: req.user.uid,
		ip: req.ip,
		...additional,
	});
}
