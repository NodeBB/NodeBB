'use strict';

const categories = require('../../categories');
const privileges = require('../../privileges');
const utils = require('../../utils');

const privilegesController = module.exports;

privilegesController.get = async function (req, res) {
	const cid = req.params.cid ? parseInt(req.params.cid, 10) || 0 : 0;
	const isAdminPriv = req.params.cid === 'admin';
	const isAllCategories = req.params.cid === 'all';

	let privilegesData;
	if (isAllCategories) {
		privilegesData = await privileges.categories.listAll();
	} else if (cid === 0) {
		privilegesData = await (isAdminPriv ? privileges.admin.list(req.uid) : privileges.global.list());
	} else if (utils.isNumber(cid)) {
		privilegesData = await privileges.categories.list(cid);
	}

	const categoriesData = [{
		cid: 'all',
		name: '[[admin/manage/privileges:all-categories]]',
		icon: 'fa-list',
	}, {
		cid: 0,
		name: '[[admin/manage/privileges:global]]',
		icon: 'fa-list',
	}, {
		cid: 'admin',
		name: '[[admin/manage/privileges:admin]]',
		icon: 'fa-lock',
	}];

	let selectedCid = cid;
	if (isAdminPriv) {
		selectedCid = 'admin';
	} else if (isAllCategories) {
		selectedCid = 'all';
	}

	let selectedCategory;
	categoriesData.forEach((category) => {
		if (category) {
			category.selected = category.cid === selectedCid;

			if (category.selected) {
				selectedCategory = category;
			}
		}
	});
	if (!selectedCategory) {
		selectedCategory = await categories.getCategoryFields(cid, ['cid', 'name', 'icon', 'bgColor', 'color']);
	}

	const group = req.query.group ? req.query.group : '';
	res.render('admin/manage/privileges', {
		privileges: privilegesData,
		categories: categoriesData,
		selectedCategory,
		cid: isAllCategories ? 'all' : cid,
		group,
		isAdminPriv,
	});
};
