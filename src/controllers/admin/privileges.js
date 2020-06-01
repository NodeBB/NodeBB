'use strict';

const categories = require('../../categories');
const privileges = require('../../privileges');

const privilegesController = module.exports;

privilegesController.get = async function (req, res) {
	const cid = req.params.cid ? parseInt(req.params.cid, 10) || 'admin' : 0;

	let method;
	const type = {
		global: false,
		admin: false,
		cid: false,
	};
	if (cid > 0) {
		method = privileges.categories.list.bind(null, cid);
		type.cid = true;
	} else if (cid === 0) {
		method = privileges.global.list;
		type.global = true;
	} else {
		method = privileges.admin.list;
		type.admin = true;
	}

	const [privilegesData, categoriesData] = await Promise.all([
		method(),
		categories.buildForSelectAll(),
	]);

	categoriesData.unshift({
		cid: 0,
		name: '[[admin/manage/privileges:global]]',
		icon: 'fa-list',
	});
	categoriesData.unshift({
		cid: 'admin',
		name: '[[admin/manage/privileges:admin]]',
		icon: 'fa-lock',
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
		type: type,
		privileges: privilegesData,
		categories: categoriesData,
		selectedCategory: selectedCategory,
		cid: cid,
	});
};
