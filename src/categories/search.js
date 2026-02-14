'use strict';

const _ = require('lodash');

const privileges = require('../privileges');
const plugins = require('../plugins');
const db = require('../database');

module.exports = function (Categories) {
	Categories.search = async function (data) {
		const query = data.query || '';
		const page = data.page || 1;
		const uid = data.uid || 0;
		const paginate = data.hasOwnProperty('paginate') ? data.paginate : true;

		const startTime = process.hrtime();

		let cids = await findCids(query, data.hardCap);

		const result = await plugins.hooks.fire('filter:categories.search', {
			data: data,
			cids: cids,
			uid: uid,
		});
		cids = await privileges.categories.filterCids('find', result.cids, uid);

		const searchResult = {
			matchCount: cids.length,
		};

		if (paginate) {
			const resultsPerPage = data.resultsPerPage || 50;
			const start = Math.max(0, page - 1) * resultsPerPage;
			const stop = start + resultsPerPage;
			searchResult.pageCount = Math.ceil(cids.length / resultsPerPage);
			cids = cids.slice(start, stop);
		}

		const childrenCids = await getChildrenCids(cids, uid);
		const uniqCids = _.uniq(cids.concat(childrenCids));
		const categoryData = await Categories.getCategories(uniqCids);

		Categories.getTree(categoryData, 0);
		await Categories.getRecentTopicReplies(categoryData, uid, data.qs);
		categoryData.forEach((category) => {
			if (category && Array.isArray(category.children)) {
				category.children = category.children.slice(0, category.subCategoriesPerPage);
				category.children.forEach((child) => {
					child.children = undefined;
				});
			}
		});

		categoryData.sort((c1, c2) => {
			if (c1.parentCid !== c2.parentCid) {
				return c1.parentCid - c2.parentCid;
			}
			return c1.order - c2.order;
		});
		searchResult.timing = (process.elapsedTimeSince(startTime) / 1000).toFixed(2);
		searchResult.categories = categoryData.filter(c => cids.includes(c.cid));
		return searchResult;
	};

	async function findCids(query, hardCap) {
		if (!query || String(query).length < 2) {
			return [];
		}
		const data = await db.getSortedSetScan({
			key: 'categories:name',
			match: `*${String(query).toLowerCase()}*`,
			limit: hardCap || 500,
		});
		return data.map(data => parseInt(data.split(':').pop(), 10));
	}

	async function getChildrenCids(cids, uid) {
		const childrenCids = await Promise.all(cids.map(cid => Categories.getChildrenCids(cid)));
		return await privileges.categories.filterCids('find', _.flatten(childrenCids), uid);
	}
};
