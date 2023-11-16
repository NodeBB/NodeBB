'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const categories = require('../categories');
const messaging = require('../messaging');
const privileges = require('../privileges');
const meta = require('../meta');
const plugins = require('../plugins');

const controllersHelpers = require('../controllers/helpers');

const searchApi = module.exports;

searchApi.categories = async (caller, data) => {
	// used by categorySearch module

	let cids = [];
	let matchedCids = [];
	const privilege = data.privilege || 'topics:read';
	data.states = (data.states || ['watching', 'tracking', 'notwatching', 'ignoring']).map(
		state => categories.watchStates[state]
	);
	data.parentCid = parseInt(data.parentCid || 0, 10);

	if (data.search) {
		({ cids, matchedCids } = await findMatchedCids(caller.uid, data));
	} else {
		cids = await loadCids(caller.uid, data.parentCid);
	}

	const visibleCategories = await controllersHelpers.getVisibleCategories({
		cids, uid: caller.uid, states: data.states, privilege, showLinks: data.showLinks, parentCid: data.parentCid,
	});

	if (Array.isArray(data.selectedCids)) {
		data.selectedCids = data.selectedCids.map(cid => parseInt(cid, 10));
	}

	let categoriesData = categories.buildForSelectCategories(visibleCategories, ['disabledClass'], data.parentCid);
	categoriesData = categoriesData.slice(0, 200);

	categoriesData.forEach((category) => {
		category.selected = data.selectedCids ? data.selectedCids.includes(category.cid) : false;
		if (matchedCids.includes(category.cid)) {
			category.match = true;
		}
	});
	const result = await plugins.hooks.fire('filter:categories.categorySearch', {
		categories: categoriesData,
		...data,
		uid: caller.uid,
	});

	return { categories: result.categories };
};

async function findMatchedCids(uid, data) {
	const result = await categories.search({
		uid: uid,
		query: data.search,
		qs: data.query,
		paginate: false,
	});

	let matchedCids = result.categories.map(c => c.cid);
	// no need to filter if all 3 states are used
	const filterByWatchState = !Object.values(categories.watchStates)
		.every(state => data.states.includes(state));

	if (filterByWatchState) {
		const states = await categories.getWatchState(matchedCids, uid);
		matchedCids = matchedCids.filter((cid, index) => data.states.includes(states[index]));
	}

	const rootCids = _.uniq(_.flatten(await Promise.all(matchedCids.map(categories.getParentCids))));
	const allChildCids = _.uniq(_.flatten(await Promise.all(matchedCids.map(categories.getChildrenCids))));

	return {
		cids: _.uniq(rootCids.concat(allChildCids).concat(matchedCids)),
		matchedCids: matchedCids,
	};
}

async function loadCids(uid, parentCid) {
	let resultCids = [];
	async function getCidsRecursive(cids) {
		const categoryData = await categories.getCategoriesFields(cids, ['subCategoriesPerPage']);
		const cidToData = _.zipObject(cids, categoryData);
		await Promise.all(cids.map(async (cid) => {
			const allChildCids = await categories.getAllCidsFromSet(`cid:${cid}:children`);
			if (allChildCids.length) {
				const childCids = await privileges.categories.filterCids('find', allChildCids, uid);
				resultCids.push(...childCids.slice(0, cidToData[cid].subCategoriesPerPage));
				await getCidsRecursive(childCids);
			}
		}));
	}

	const allRootCids = await categories.getAllCidsFromSet(`cid:${parentCid}:children`);
	const rootCids = await privileges.categories.filterCids('find', allRootCids, uid);
	const pageCids = rootCids.slice(0, meta.config.categoriesPerPage);
	resultCids = pageCids;
	await getCidsRecursive(pageCids);
	return resultCids;
}

searchApi.roomUsers = async (caller, { query, roomId }) => {
	const [isAdmin, inRoom, isRoomOwner] = await Promise.all([
		user.isAdministrator(caller.uid),
		messaging.isUserInRoom(caller.uid, roomId),
		messaging.isRoomOwner(caller.uid, roomId),
	]);

	if (!isAdmin && !inRoom) {
		throw new Error('[[error:no-privileges]]');
	}

	const results = await user.search({
		query,
		paginate: false,
		hardCap: -1,
		uid: caller.uid,
	});

	const { users } = results;
	const foundUids = users.map(user => user && user.uid);
	const isUidInRoom = _.zipObject(
		foundUids,
		await messaging.isUsersInRoom(foundUids, roomId)
	);

	const roomUsers = users.filter(user => isUidInRoom[user.uid]);
	const isOwners = await messaging.isRoomOwner(roomUsers.map(u => u.uid), roomId);

	roomUsers.forEach((user, index) => {
		if (user) {
			user.isOwner = isOwners[index];
			user.canKick = isRoomOwner && (parseInt(user.uid, 10) !== parseInt(caller.uid, 10));
		}
	});

	roomUsers.sort((a, b) => {
		if (a.isOwner && !b.isOwner) {
			return -1;
		} else if (!a.isOwner && b.isOwner) {
			return 1;
		}
		return 0;
	});

	return { users: roomUsers };
};

searchApi.roomMessages = async (caller, { query, roomId, uid }) => {
	const [roomData, inRoom] = await Promise.all([
		messaging.getRoomData(roomId),
		messaging.isUserInRoom(caller.uid, roomId),
	]);

	if (!roomData) {
		throw new Error('[[error:no-room]]');
	}
	if (!inRoom) {
		throw new Error('[[error:no-privileges]]');
	}
	const { ids } = await plugins.hooks.fire('filter:messaging.searchMessages', {
		content: query,
		roomId: [roomId],
		uid: [uid],
		matchWords: 'any',
		ids: [],
	});

	let userjoinTimestamp = 0;
	if (!roomData.public) {
		userjoinTimestamp = await db.sortedSetScore(`chat:room:${roomId}:uids`, caller.uid);
	}
	let messageData = await messaging.getMessagesData(ids, caller.uid, roomId, false);
	messageData = messageData
		.map((msg) => {
			if (msg) {
				msg.newSet = true;
			}
			return msg;
		})
		.filter(msg => msg && !msg.deleted && msg.timestamp > userjoinTimestamp);

	return { messages: messageData };
};
