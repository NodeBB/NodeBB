'use strict';

const db = require('../database');
const utils = require('../utils');

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