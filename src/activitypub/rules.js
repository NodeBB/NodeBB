'use strict';

const validator = require('validator');

const db = require('../database');
const utils = require('../utils');

const activitypub = require('.');

const Rules = module.exports;

Rules.list = async () => {
	const rids = await db.getSortedSetMembers('categorization:rid');
	let rules = await db.getObjects(rids.map(rid => `rid:${rid}`));
	rules = rules.map((rule, idx) => {
		rule.rid = rids[idx];
		rule.cid = parseInt(rule.cid, 10);
		rule.value = validator.escape(rule.value);
		rule.filter = typeof rule.filter === 'string' ? rule.filter === 'true' : rule.filter;
		return rule;
	});

	return rules;
};

Rules.upsert = async (type, value, cid, filter) => {
	const rules = await Rules.list();
	const existing = rules.find(rule => rule.type === type && rule.value === value);

	// normalize user rule values into a uid
	if (type === 'user' && value.indexOf('@') !== -1) {
		const response = await activitypub.actors.assert(value);
		if (!response) {
			throw new Error('[[error:no-user]]');
		}
		value = await db.getObjectField('handle:uid', String(value).toLowerCase());
	}

	if (existing) {
		await db.setObject(`rid:${existing.rid}`, {
			cid,
			filter: !!filter,
		});

		return existing.rid;
	}

	const uuid = utils.generateUUID();
	await Promise.all([
		db.setObject(`rid:${uuid}`, { type, value, cid, filter: !!filter }),
		db.sortedSetAdd('categorization:rid', Date.now(), uuid),
	]);
	return uuid;
};

Rules.delete = async (rid) => {
	await Promise.all([
		db.sortedSetRemove('categorization:rid', rid),
		db.delete(`rid:${rid}`),
	]);
};

Rules.reorder = async (rids) => {
	const exists = await db.isSortedSetMembers('categorization:rid', rids);
	rids = rids.filter((_, idx) => exists[idx]);
	const scores = Array.from({ length: rids.length }, (_, idx) => idx);

	await db.sortedSetAdd('categorization:rid', scores, rids);
};