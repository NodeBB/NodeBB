'use strict';

const _ = require('lodash');

const groups = require('../../groups');
const categories = require('../../categories');
const privileges = require('../../privileges');
const user = require('../../user');

const AdminsMods = module.exports;

AdminsMods.get = async function (req, res) {
	const [admins, globalMods, categories] = await Promise.all([
		groups.get('administrators', { uid: req.uid }),
		groups.get('Global Moderators', { uid: req.uid }),
		getModeratorsOfCategories(),
	]);

	res.render('admin/manage/admins-mods', {
		admins: admins,
		globalMods: globalMods,
		categories: categories,
		allPrivileges: privileges.userPrivilegeList,
	});
};

async function getModeratorsOfCategories() {
	const categoryData = await categories.buildForSelectAll(['depth', 'disabled']);
	const moderatorUids = await categories.getModeratorUids(categoryData.map(c => c.cid));
	const uids = _.uniq(_.flatten(moderatorUids));
	const moderatorData = await user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);
	const moderatorMap = _.zipObject(uids, moderatorData);
	categoryData.forEach((c, index) => {
		c.moderators = moderatorUids[index].map(uid => moderatorMap[uid]);
	});
	return categoryData;
}
