'use strict';

const categories = require('../../categories');
const privileges = require('../../privileges');

const privilegesController = module.exports;

privilegesController.get = async function (req, res) {
	const cid = req.params.cid ? parseInt(req.params.cid, 10) || 0 : 0;
	const isAdminPriv = req.params.cid === 'admin';

	let method;
	if (cid > 0) {
		method = privileges.categories.list.bind(null, cid);
	} else if (cid === 0) {
		method = isAdminPriv ? privileges.admin.list : privileges.global.list;
	}

	const [privilegesData, categoriesData] = await Promise.all([
		method(isAdminPriv ? req.uid : undefined),
		categories.buildForSelectAll(),
	]);

	categoriesData.unshift({
		cid: 0,
		name: '[[admin/manage/privileges:global]]',
		icon: 'fa-list',
	}, {
		cid: 'admin',	// what do?
		name: '[[admin/manage/privileges:admin]]',
		icon: 'fa-lock',
	});

	let selectedCategory;
	categoriesData.forEach(function (category) {
		if (category) {
			category.selected = category.cid === (!isAdminPriv ? cid : 'admin');

			if (category.selected) {
				selectedCategory = category;
			}
		}
	});
	const group = req.query.group ? req.query.group : '';
	res.render('admin/manage/privileges', {
		privileges: privilegesData,
		categories: categoriesData,
		selectedCategory: selectedCategory,
		cid: cid,
		group: group,
	});
};
