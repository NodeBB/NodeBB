'use strict';

const db = require('../database');
const utils = require('../utils');

const activitypub = require('.');

const Rules = module.exports;

Rules.list = async () => {
	const rids = await db.getSortedSetMembers('categorization:rid');
	let rules = await db.getObjects(rids.map(rid => `rid:${rid}`));
	rules = rules.map((rule, idx) => {
		rule.rid = rids[idx];
		return rule;
	});

	return rules;
};

Rules.add = async (type, value, cid) => {
	const uuid = utils.generateUUID();

	// normalize user rule values into a uid
	if (type === 'user' && value.indexOf('@') !== -1) {
		const response = await activitypub.actors.assert(value);
		if (!response) {
			throw new Error('[[error:no-user]]');
		}
		value = await db.getObjectField('handle:uid', String(value).toLowerCase());
	}

	await Promise.all([
		db.setObject(`rid:${uuid}`, { type, value, cid }),
		db.sortedSetAdd('categorization:rid', Date.now(), uuid),
	]);
};

Rules.delete = async (rid) => {
	await Promise.all([
		db.sortedSetRemove('categorization:rid', rid),
		db.delete(`rid:${rid}`),
	]);
};