'use strict';

const categories = require('../../categories');
const privileges = require('../../privileges');

const privilegesController = module.exports;

privilegesController.get = async function (req, res) {
	const cid = req.params.cid ? parseInt(req.params.cid, 10) : 0;
	const [privilegesData, categoriesData] = await Promise.all([
		getPrivileges(cid),
		getCategories(req.uid),
	]);

	categoriesData.unshift({
		cid: 0,
		name: '[[admin/manage/privileges:global]]',
		icon: 'fa-list',
	});

	let selectedCategory;
	categoriesData.forEach(function (category) {
		if (category) {
			category.selected = category.cid === cid;

			if (category.selected) {
				selectedCategory = category;
			}
		}
	});

	res.render('admin/manage/privileges', {
		privileges: privilegesData,
		categories: categoriesData,
		selectedCategory: selectedCategory,
		cid: cid,
	});
};

async function getPrivileges(cid) {
	if (!cid) {
		return await privileges.global.list();
	}
	return await privileges.categories.list(cid);
}

async function getCategories(uid) {
	const cids = await categories.getAllCidsFromSet('categories:cid');
	const categoriesData = await categories.getCategories(cids, uid);
	const tree = categories.getTree(categoriesData);
	return await categories.buildForSelectCategories(tree);
}
