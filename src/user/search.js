
'use strict';

const _ = require('lodash');

const meta = require('../meta');
const plugins = require('../plugins');
const db = require('../database');
const groups = require('../groups');
const utils = require('../utils');

module.exports = function (User) {
	const filterFnMap = {
		online: user => user.status !== 'offline' && (Date.now() - user.lastonline < 300000),
		flagged: user => parseInt(user.flags, 10) > 0,
		verified: user => !!user['email:confirmed'],
		unverified: user => !user['email:confirmed'],
	};

	const filterFieldMap = {
		online: ['status', 'lastonline'],
		flagged: ['flags'],
		verified: ['email:confirmed'],
		unverified: ['email:confirmed'],
	};


	User.search = async function (data) {
		const query = data.query || '';
		const searchBy = data.searchBy || 'username';
		const page = data.page || 1;
		const uid = data.uid || 0;
		const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;

		const startTime = process.hrtime();

		let uids = [];
		if (searchBy === 'ip') {
			uids = await searchByIP(query);
		} else if (searchBy === 'uid') {
			uids = [query];
		} else {
			const searchMethod = data.findUids || findUids;
			uids = await searchMethod(query, searchBy, data.hardCap);
		}

		uids = await filterAndSortUids(uids, data);
		const result = await plugins.hooks.fire('filter:users.search', { uids: uids, uid: uid });
		uids = result.uids;

		const searchResult = {
			matchCount: uids.length,
		};

		if (paginate) {
			const resultsPerPage = data.resultsPerPage || meta.config.userSearchResultsPerPage;
			const start = Math.max(0, page - 1) * resultsPerPage;
			const stop = start + resultsPerPage;
			searchResult.pageCount = Math.ceil(uids.length / resultsPerPage);
			uids = uids.slice(start, stop);
		}

		const [userData, blocks] = await Promise.all([
			User.getUsers(uids, uid),
			User.blocks.list(uid),
		]);

		if (blocks.length) {
			userData.forEach((user) => {
				if (user) {
					user.isBlocked = blocks.includes(user.uid);
				}
			});
		}

		searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
		searchResult.users = userData.filter(user => user && user.uid > 0);
		return searchResult;
	};

	async function findUids(query, searchBy, hardCap) {
		if (!query) {
			return [];
		}
		query = String(query).toLowerCase();
		const min = query;
		const max = query.substr(0, query.length - 1) + String.fromCharCode(query.charCodeAt(query.length - 1) + 1);

		const resultsPerPage = meta.config.userSearchResultsPerPage;
		hardCap = hardCap || resultsPerPage * 10;

		const data = await db.getSortedSetRangeByLex(`${searchBy}:sorted`, min, max, 0, hardCap);
		const uids = data.map(data => data.split(':').pop());
		return uids;
	}

	async function filterAndSortUids(uids, data) {
		uids = uids.filter(uid => parseInt(uid, 10));
		let filters = data.filters || [];
		filters = Array.isArray(filters) ? filters : [data.filters];
		const fields = [];

		if (data.sortBy) {
			fields.push(data.sortBy);
		}

		filters.forEach((filter) => {
			if (filterFieldMap[filter]) {
				fields.push(...filterFieldMap[filter]);
			}
		});

		if (data.groupName) {
			const isMembers = await groups.isMembers(uids, data.groupName);
			uids = uids.filter((uid, index) => isMembers[index]);
		}

		if (!fields.length) {
			return uids;
		}

		if (filters.includes('banned') || filters.includes('notbanned')) {
			const isMembersOfBanned = await groups.isMembers(uids, groups.BANNED_USERS);
			const checkBanned = filters.includes('banned');
			uids = uids.filter((uid, index) => (checkBanned ? isMembersOfBanned[index] : !isMembersOfBanned[index]));
		}

		fields.push('uid');
		let userData = await User.getUsersFields(uids, fields);

		filters.forEach((filter) => {
			if (filterFnMap[filter]) {
				userData = userData.filter(filterFnMap[filter]);
			}
		});

		if (data.sortBy) {
			sortUsers(userData, data.sortBy, data.sortDirection);
		}

		return userData.map(user => user.uid);
	}

	function sortUsers(userData, sortBy, sortDirection) {
		if (!userData || !userData.length) {
			return;
		}
		sortDirection = sortDirection || 'desc';
		const direction = sortDirection === 'desc' ? 1 : -1;

		const isNumeric = utils.isNumber(userData[0][sortBy]);
		if (isNumeric) {
			userData.sort((u1, u2) => direction * (u2[sortBy] - u1[sortBy]));
		} else {
			userData.sort((u1, u2) => {
				if (u1[sortBy] < u2[sortBy]) {
					return direction * -1;
				} else if (u1[sortBy] > u2[sortBy]) {
					return direction * 1;
				}
				return 0;
			});
		}
	}

	async function searchByIP(ip) {
		const ipKeys = await db.scan({ match: `ip:${ip}*` });
		const uids = await db.getSortedSetRevRange(ipKeys, 0, -1);
		return _.uniq(uids);
	}
};
