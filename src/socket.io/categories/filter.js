'use strict';

const _ = require('lodash');

const meta = require('../../meta');
const categories = require('../../categories');
const privileges = require('../../privileges');
const controllersHelpers = require('../../controllers/helpers');

module.exports = function (SocketCategories) {
	SocketCategories.loadCategoryFilter = async function (socket, data) {
		let cids = [];
		let matchedCids = [];
		const privilege = data.privilege || 'topics:read';
		if (data.query) {
			({ cids, matchedCids } = await findMatchedCids(data));
		} else {
			cids = await loadCids(socket.uid);
		}

		const states = (data.states || ['watching', 'notwatching', 'ignoring']).map(
			state => categories.watchStates[state]
		);
		const visibleCategories = await controllersHelpers.getVisibleCategories(
			cids, socket.uid, states, privilege
		);

		let categoriesData = categories.buildForSelectCategories(visibleCategories, ['disabledClass']);

		// TODO: send start for pagination from dropdown
		const start = 0;
		const stop = start + 200 - 1;

		categoriesData = categoriesData.slice(start, stop);
		categoriesData.forEach(function (category) {
			category.selected = data.selectedCids ? data.selectedCids.includes(category.cid) : false;
			if (matchedCids.includes(category.cid)) {
				category.match = true;
			}
		});
		return categoriesData;
	};

	async function findMatchedCids(data) {
		const result = await categories.search({
			query: data.query,
			paginate: false,
		});
		async function addParentsToRoot(currentCid) {
			let cid = currentCid;
			const toParent = [];
			while (parseInt(cid, 10)) {
				/* eslint-disable no-await-in-loop */
				cid = await categories.getCategoryField(cid, 'parentCid');
				if (cid) {
					toParent.push(cid);
				}
			}
			return toParent;
		}

		const matchedCids = result.categories.map(c => c.cid);
		const rootCids = _.uniq(_.flatten(await Promise.all(matchedCids.map(addParentsToRoot))));
		const allChildCids = _.uniq(_.flatten(await Promise.all(matchedCids.map(cid => categories.getChildrenCids(cid)))));

		return {
			cids: _.uniq(rootCids.concat(allChildCids).concat(matchedCids)),
			matchedCids: matchedCids,
		};
	}

	async function loadCids(uid) {
		const allRootCids = await categories.getAllCidsFromSet('cid:0:children');
		const rootCids = await privileges.categories.filterCids('find', allRootCids, uid);
		const pageCids = rootCids.slice(0, meta.config.categoriesPerPage);
		const allChildCids = _.flatten(await Promise.all(pageCids.map(cid => categories.getChildrenCids(cid))));
		const childCids = await privileges.categories.filterCids('find', allChildCids, uid);
		return pageCids.concat(childCids);
	}
};
