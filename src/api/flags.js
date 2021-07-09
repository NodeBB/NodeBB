'use strict';

const user = require('../user');
const flags = require('../flags');

const flagsApi = module.exports;

flagsApi.create = async (caller, data) => {
	const required = ['type', 'id', 'reason'];
	if (!required.every(prop => !!data[prop])) {
		throw new Error('[[error:invalid-data]]');
	}

	const { type, id, reason } = data;

	await flags.validate({
		uid: caller.uid,
		type: type,
		id: id,
	});

	const flagObj = await flags.create(type, id, caller.uid, reason);
	flags.notify(flagObj, caller.uid);

	return flagObj;
};

flagsApi.update = async (caller, data) => {
	const allowed = await user.isPrivileged(caller.uid);
	if (!allowed) {
		throw new Error('[[no-privileges]]');
	}

	const { flagId } = data;
	delete data.flagId;

	await flags.update(flagId, caller.uid, data);
	return await flags.getHistory(flagId);
};
