'use strict';

const _ = require('lodash');

const meta = require('../../meta');
const categories = require('../../categories');
const privileges = require('../../privileges');
const controllersHelpers = require('../../controllers/helpers');

module.exports = function (SocketCategories) {
	// used by categorySeach module
	SocketCategories.categorySearch = async function (socket, data) {
		let cids = [];
		let matchedCids = [];
		const privilege = data.privilege || 'topics:read';
		data.states = (data.states || ['watching', 'notwatching', 'ignoring']).map(
			state => categories.watchStates[state]
		);

		if (data.query) {
			({ cids, matchedCids } = await findMatchedCids(socket.uid, data));
		} else {
			cids = await loadCids(socket.uid, data.parentCid);
		}

		const visibleCategories = await controllersHelpers.getVisibleCategories({
			cids, uid: socket.uid, states: data.states, privilege, showLinks: data.showLinks, parentCid: data.parentCid,
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
		return categoriesData;
	};

	async function findMatchedCids(uid, data) {
		const result = await categories.search({
			uid: uid,
			query: data.query,
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
};
