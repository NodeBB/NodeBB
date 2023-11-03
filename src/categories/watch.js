'use strict';

const db = require('../database');
const user = require('../user');

module.exports = function (Categories) {
	Categories.watchStates = {
		ignoring: 1,
		notwatching: 2,
		tracking: 3,
		watching: 4,
	};

	Categories.isIgnored = async function (cids, uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return cids.map(() => false);
		}
		const states = await Categories.getWatchState(cids, uid);
		return states.map(state => state === Categories.watchStates.ignoring);
	};

	Categories.getWatchState = async function (cids, uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return cids.map(() => Categories.watchStates.notwatching);
		}
		if (!Array.isArray(cids) || !cids.length) {
			return [];
		}
		const keys = cids.map(cid => `cid:${cid}:uid:watch:state`);
		const [userSettings, states] = await Promise.all([
			user.getSettings(uid),
			db.sortedSetsScore(keys, uid),
		]);
		return states.map(state => state || Categories.watchStates[userSettings.categoryWatchState]);
	};

	Categories.getIgnorers = async function (cid, start, stop) {
		const count = (stop === -1) ? -1 : (stop - start + 1);
		return await db.getSortedSetRevRangeByScore(`cid:${cid}:uid:watch:state`, start, count, Categories.watchStates.ignoring, Categories.watchStates.ignoring);
	};

	Categories.filterIgnoringUids = async function (cid, uids) {
		const states = await Categories.getUidsWatchStates(cid, uids);
		const readingUids = uids.filter((uid, index) => uid && states[index] !== Categories.watchStates.ignoring);
		return readingUids;
	};

	Categories.getUidsWatchStates = async function (cid, uids) {
		const [userSettings, states] = await Promise.all([
			user.getMultipleUserSettings(uids),
			db.sortedSetScores(`cid:${cid}:uid:watch:state`, uids),
		]);
		return states.map((state, index) => state || Categories.watchStates[userSettings[index].categoryWatchState]);
	};
};
