'use strict';

const groups = require('../../groups');
const categories = require('../../categories');
const privileges = require('../../privileges');

const AdminsMods = module.exports;

AdminsMods.get = async function (req, res) {
	const [admins, globalMods, categories] = await Promise.all([
		groups.get('administrators', { uid: req.uid }),
		groups.get('Global Moderators', { uid: req.uid }),
		getModeratorsOfCategories(req.uid),
	]);

	res.render('admin/manage/admins-mods', {
		admins: admins,
		globalMods: globalMods,
		categories: categories,
		allPrivileges: privileges.userPrivilegeList,
	});
};

async function getModeratorsOfCategories(uid) {
	const categoryData = await categories.buildForSelect(uid, 'find', ['depth']);
	const moderators = await Promise.all(categoryData.map(c => categories.getModerators(c.cid)));
	categoryData.forEach((c, index) => {
		c.moderators = moderators[index];
	});
	return categoryData;
}
