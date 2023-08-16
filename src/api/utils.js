'use strict';

const db = require('../database');

const user = require('../user');
const srcUtils = require('../utils');

const utils = module.exports;

// internal token management utilities only
utils.tokens = {};

utils.tokens.list = async (start = 0, stop = -1) => {
	// Validation handled at higher level
	const tokens = await db.getSortedSetRange(`tokens:createtime`, start, stop);
	return await utils.tokens.get(tokens);
};

utils.tokens.count = async () => await db.sortedSetCard('tokens:createtime');

utils.tokens.get = async (tokens) => {
	// Validation handled at higher level
	if (!tokens) {
		throw new Error('[[error:invalid-data]]');
	}

	let singular = false;
	if (!Array.isArray(tokens)) {
		tokens = [tokens];
		singular = true;
	}

	let [tokenObjs, lastSeen] = await Promise.all([
		db.getObjects(tokens.map(t => `token:${t}`)),
		utils.tokens.getLastSeen(tokens),
	]);

	tokenObjs = tokenObjs.map((tokenObj, idx) => {
		if (!tokenObj) {
			return null;
		}

		tokenObj.token = tokens[idx];
		tokenObj.lastSeen = lastSeen[idx];
		tokenObj.lastSeenISO = lastSeen[idx] ? new Date(lastSeen[idx]).toISOString() : null;
		tokenObj.timestampISO = new Date(parseInt(tokenObj.timestamp, 10)).toISOString();

		return tokenObj;
	});

	return singular ? tokenObjs[0] : tokenObjs;
};

utils.tokens.generate = async ({ uid, description }) => {
	if (parseInt(uid, 10) !== 0) {
		const uidExists = await user.exists(uid);
		if (!uidExists) {
			throw new Error('[[error:no-user]]');
		}
	}

	const token = srcUtils.generateUUID();
	const timestamp = Date.now();

	return utils.tokens.add({ token, uid, description, timestamp });
};

utils.tokens.add = async ({ token, uid, description = '', timestamp = Date.now() }) => {
	if (!token || uid === undefined) {
		throw new Error('[[error:invalid-data]]');
	}

	await Promise.all([
		db.setObject(`token:${token}`, { uid, description, timestamp }),
		db.sortedSetAdd(`tokens:createtime`, timestamp, token),
		db.sortedSetAdd(`tokens:uid`, uid, token),
	]);

	return token;
};

utils.tokens.update = async (token, { uid, description }) => {
	await Promise.all([
		db.setObject(`token:${token}`, { uid, description }),
		db.sortedSetAdd(`tokens:uid`, uid, token),
	]);

	return await utils.tokens.get(token);
};

utils.tokens.roll = async (token) => {
	const [createTime, uid, lastSeen] = await db.sortedSetsScore([`tokens:createtime`, `tokens:uid`, `tokens:lastSeen`], token);
	const newToken = srcUtils.generateUUID();

	const updates = [
		db.rename(`token:${token}`, `token:${newToken}`),
		db.sortedSetsRemove([
			`tokens:createtime`,
			`tokens:uid`,
			`tokens:lastSeen`,
		], token),
		db.sortedSetAdd(`tokens:createtime`, createTime, newToken),
		db.sortedSetAdd(`tokens:uid`, uid, newToken),
	];

	if (lastSeen) {
		updates.push(db.sortedSetAdd(`tokens:lastSeen`, lastSeen, newToken));
	}

	await Promise.all(updates);

	return newToken;
};

utils.tokens.delete = async (token) => {
	await Promise.all([
		db.delete(`token:${token}`),
		db.sortedSetsRemove([
			`tokens:createtime`,
			`tokens:uid`,
			`tokens:lastSeen`,
		], token),
	]);
};

utils.tokens.log = async (token) => {
	await db.sortedSetAdd('tokens:lastSeen', Date.now(), token);
};

utils.tokens.getLastSeen = async tokens => await db.sortedSetScores('tokens:lastSeen', tokens);
