'use strict';

const _ = require('lodash');

import db from '../../database';
const groups = require('../../groups');
import categories from '../../categories';import user from '../../user';
import meta from '../../meta';
const pagination = require('../../pagination');
const categoriesController = require('./categories');

const AdminsMods  = {} as any;

AdminsMods.get = async function (req, res) {
	const rootCid = parseInt(req.query.cid, 10) || 0;

	const cidsCount = await db.sortedSetCard(`cid:${rootCid}:children`);

	const pageCount = Math.max(1, Math.ceil(cidsCount / meta.config.categoriesPerPage));
	const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
	const start = Math.max(0, (page - 1) * meta.config.categoriesPerPage);
	const stop = start + meta.config.categoriesPerPage - 1;

	const cids = await db.getSortedSetRange(`cid:${rootCid}:children`, start, stop);
    // @ts-ignore
	const selectedCategory = rootCid ? await categories.getCategoryData(rootCid) : null;
	// @ts-ignore
	const pageCategories = await categories.getCategoriesData(cids);

	const [admins, globalMods, moderators, crumbs] = await Promise.all([
		groups.get('administrators', { uid: req.uid }),
		groups.get('Global Moderators', { uid: req.uid }),
		getModeratorsOfCategories(pageCategories),
		categoriesController.buildBreadCrumbs(selectedCategory, '/admin/manage/admins-mods'),
	]);

	res.render('admin/manage/admins-mods', {
		admins: admins,
		globalMods: globalMods,
		categoryMods: moderators,
		selectedCategory: selectedCategory,
		pagination: pagination.create(page, pageCount, req.query),
		breadcrumbs: crumbs,
	});
};

async function getModeratorsOfCategories(categoryData) {
	const [moderatorUids, childrenCounts] = await Promise.all([
		// @ts-ignore
		categories.getModeratorUids(categoryData.map((c) => c.cid)),
		db.sortedSetsCard(categoryData.map((c) => `cid:${c.cid}:children`)),
	]);

	const uids = _.uniq(_.flatten(moderatorUids));
	const moderatorData = await user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
	const moderatorMap = _.zipObject(uids, moderatorData);
	categoryData.forEach((c, index: number) => {
		c.moderators = moderatorUids[index].map((uid: string) => moderatorMap[uid]);
		c.subCategoryCount = childrenCounts[index];
	});
	return categoryData;
}
