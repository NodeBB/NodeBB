'use strict';

const privileges = require('../privileges');
const events = require('../events');
const groups = require('../groups');

const groupsAPI = module.exports;

groupsAPI.create = async function (caller, data) {
	if (!caller.uid) {
		throw new Error('[[error:no-privileges]]');
	} else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	const canCreate = await privileges.global.can('group:create', caller.uid);
	if (!canCreate) {
		throw new Error('[[error:no-privileges]]');
	}
	data.ownerUid = caller.uid;
	data.system = false;
	const groupData = await groups.create(data);
	logGroupEvent(caller, 'group-create', {
		groupName: data.name,
	});

	return groupData;
};

// groupsAPI.join = async function (caller, data) {
// 	// TODO:
// };

// groupsAPI.leave = async function (caller, data) {
// 	// TODO:
// };

// groupsAPI.delete = async function (caller, data) {
// 	// TODO:
// };

function logGroupEvent(caller, event, additional) {
	events.log({
		type: event,
		uid: caller.uid,
		ip: caller.ip,
		...additional,
	});
}
