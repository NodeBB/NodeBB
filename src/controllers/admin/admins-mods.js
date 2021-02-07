'use strict';

const _ = require('lodash');

const db = require('../../database');
const groups = require('../../groups');
const categories = require('../../categories');
const privileges = require('../../privileges');
const user = require('../../user');

const AdminsMods = module.exports;

AdminsMods.get = async function (req, res, next) {
	let cid = parseInt(req.query.cid, 10) || 0;
	if (!cid) {
		cid = (await db.getSortedSetRange('cid:0:children', 0, 0))[0];
	}
	const selectedCategory = await categories.getCategoryData(cid);
	if (!selectedCategory) {
		return next();
	}
	const [admins, globalMods, moderators] = await Promise.all([
		groups.get('administrators', { uid: req.uid }),
		groups.get('Global Moderators', { uid: req.uid }),
		getModeratorsOfCategories(selectedCategory),
	]);

	res.render('admin/manage/admins-mods', {
		admins: admins,
		globalMods: globalMods,
		categoryMods: [moderators],
		selectedCategory: selectedCategory,
		allPrivileges: privileges.userPrivilegeList,
	});
};

async function getModeratorsOfCategories(categoryData) {
	const moderatorUids = await categories.getModeratorUids([categoryData.cid]);
	const uids = _.uniq(_.flatten(moderatorUids));
	const moderatorData = await user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
	categoryData.moderators = moderatorData;
	return categoryData;
}
