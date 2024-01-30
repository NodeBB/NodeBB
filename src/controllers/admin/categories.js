'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const categories = require('../../categories');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const translator = require('../../translator');
const meta = require('../../meta');
const helpers = require('../helpers');
const pagination = require('../../pagination');

const categoriesController = module.exports;

categoriesController.get = async function (req, res, next) {
	const [categoryData, parent, selectedData] = await Promise.all([
		categories.getCategories([req.params.category_id]),
		categories.getParents([req.params.category_id]),
		helpers.getSelectedCategory(req.params.category_id),
	]);

	const category = categoryData[0];
	if (!category) {
		return next();
	}

	category.parent = parent[0];

	const data = await plugins.hooks.fire('filter:admin.category.get', {
		req: req,
		res: res,
		category: category,
		customClasses: [],
	});
	data.category.name = translator.escape(String(data.category.name));
	data.category.description = translator.escape(String(data.category.description));

	res.render('admin/manage/category', {
		category: data.category,
		selectedCategory: selectedData.selectedCategory,
		customClasses: data.customClasses,
		postQueueEnabled: !!meta.config.postQueue,
	});
};

categoriesController.getAll = async function (req, res) {
	const rootCid = parseInt(req.query.cid, 10) || 0;
	async function getRootAndChildren() {
		const rootChildren = await categories.getAllCidsFromSet(`cid:${rootCid}:children`);
		const childCids = _.flatten(await Promise.all(rootChildren.map(cid => categories.getChildrenCids(cid))));
		return [rootCid].concat(rootChildren.concat(childCids));
	}

	// Categories list will be rendered on client side with recursion, etc.
	const cids = await (rootCid ? getRootAndChildren() : categories.getAllCidsFromSet('categories:cid'));

	let rootParent = 0;
	if (rootCid) {
		rootParent = await categories.getCategoryField(rootCid, 'parentCid') || 0;
	}

	const fields = [
		'cid', 'name', 'icon', 'parentCid', 'disabled', 'link',
		'order', 'color', 'bgColor', 'backgroundImage', 'imageClass',
		'subCategoriesPerPage', 'description',
	];
	const categoriesData = await categories.getCategoriesFields(cids, fields);
	const result = await plugins.hooks.fire('filter:admin.categories.get', { categories: categoriesData, fields: fields });
	let tree = categories.getTree(result.categories, rootParent);
	const cidsCount = rootCid && tree[0] ? tree[0].children.length : tree.length;

	const pageCount = Math.max(1, Math.ceil(cidsCount / meta.config.categoriesPerPage));
	const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
	const start = Math.max(0, (page - 1) * meta.config.categoriesPerPage);
	const stop = start + meta.config.categoriesPerPage;

	function trim(c) {
		if (c.children) {
			c.subCategoriesLeft = Math.max(0, c.children.length - c.subCategoriesPerPage);
			c.hasMoreSubCategories = c.children.length > c.subCategoriesPerPage;
			c.showMorePage = Math.ceil(c.subCategoriesPerPage / meta.config.categoriesPerPage);
			c.children = c.children.slice(0, c.subCategoriesPerPage);
			c.children.forEach(c => trim(c));
		}
	}
	if (rootCid && tree[0] && Array.isArray(tree[0].children)) {
		tree[0].children = tree[0].children.slice(start, stop);
		tree[0].children.forEach(trim);
	} else {
		tree = tree.slice(start, stop);
		tree.forEach(trim);
	}

	let selectedCategory;
	if (rootCid) {
		selectedCategory = await categories.getCategoryData(rootCid);
	}
	const crumbs = await buildBreadcrumbs(selectedCategory, '/admin/manage/categories');
	res.render('admin/manage/categories', {
		categoriesTree: tree,
		selectedCategory: selectedCategory,
		breadcrumbs: crumbs,
		pagination: pagination.create(page, pageCount, req.query),
		categoriesPerPage: meta.config.categoriesPerPage,
		selectCategoryLabel: '[[admin/manage/categories:jump-to]]',
	});
};

async function buildBreadcrumbs(categoryData, url) {
	if (!categoryData) {
		return;
	}
	const breadcrumbs = [
		{
			text: categoryData.name,
			url: `${nconf.get('relative_path')}${url}?cid=${categoryData.cid}`,
			cid: categoryData.cid,
		},
	];
	const allCrumbs = await helpers.buildCategoryBreadcrumbs(categoryData.parentCid);
	const crumbs = allCrumbs.filter(c => c.cid);

	crumbs.forEach((c) => {
		c.url = `${url}?cid=${c.cid}`;
	});
	crumbs.unshift({
		text: '[[admin/manage/categories:top-level]]',
		url: url,
	});

	return crumbs.concat(breadcrumbs);
}

categoriesController.buildBreadCrumbs = buildBreadcrumbs;

categoriesController.getAnalytics = async function (req, res) {
	const [name, analyticsData, selectedData] = await Promise.all([
		categories.getCategoryField(req.params.category_id, 'name'),
		analytics.getCategoryAnalytics(req.params.category_id),
		helpers.getSelectedCategory(req.params.category_id),
	]);
	res.render('admin/manage/category-analytics', {
		name: name,
		analytics: analyticsData,
		selectedCategory: selectedData.selectedCategory,
	});
};
