'use strict';

const _ = require('lodash');

const db = require('../database');
const categories = require('../categories');
const plugins = require('../plugins');

module.exports = function (User) {
	User.setCategoryWatchState = async function (uid, cids, state) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const isStateValid = Object.values(categories.watchStates).includes(parseInt(state, 10));
		if (!isStateValid) {
			throw new Error('[[error:invalid-watch-state]]');
		}
		cids = Array.isArray(cids) ? cids : [cids];
		const exists = await categories.exists(cids);
		if (exists.includes(false)) {
			throw new Error('[[error:no-category]]');
		}
		await db.sortedSetsAdd(cids.map(cid => `cid:${cid}:uid:watch:state`), state, uid);
	};

	User.getCategoryWatchState = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return {};
		}

		const cids = await categories.getAllCidsFromSet('categories:cid');
		const states = await categories.getWatchState(cids, uid);
		return _.zipObject(cids, states);
	};

	User.getIgnoredCategories = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return [];
		}
		const cids = await User.getCategoriesByStates(uid, [categories.watchStates.ignoring]);
		const result = await plugins.hooks.fire('filter:user.getIgnoredCategories', {
			uid: uid,
			cids: cids,
		});
		return result.cids;
	};

	User.getWatchedCategories = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return [];
		}
		let cids = await User.getCategoriesByStates(uid, [categories.watchStates.watching]);
		const categoryData = await categories.getCategoriesFields(cids, ['disabled']);
		cids = cids.filter((cid, index) => categoryData[index] && !categoryData[index].disabled);
		const result = await plugins.hooks.fire('filter:user.getWatchedCategories', {
			uid: uid,
			cids: cids,
		});
		return result.cids;
	};

	User.getCategoriesByStates = async function (uid, states) {
		const cids = await categories.getAllCidsFromSet('categories:cid');
		if (!(parseInt(uid, 10) > 0)) {
			return cids;
		}
		const userState = await categories.getWatchState(cids, uid);
		return cids.filter((cid, index) => states.includes(userState[index]));
	};

	User.ignoreCategory = async function (uid, cid) {
		await User.setCategoryWatchState(uid, cid, categories.watchStates.ignoring);
	};

	User.watchCategory = async function (uid, cid) {
		await User.setCategoryWatchState(uid, cid, categories.watchStates.watching);
	};
};
