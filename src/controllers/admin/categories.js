'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const db = require('../../database');
const user = require('../../user');
const categories = require('../../categories');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const translator = require('../../translator');
const meta = require('../../meta');
const activitypub = require('../../activitypub');
const helpers = require('../helpers');
const pagination = require('../../pagination');
const utils = require('../../utils');
const cache = require('../../cache');

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
	const rootChildren = await categories.getAllCidsFromSet(`cid:${rootCid}:children`);
	async function getRootAndChildren() {
		const childCids = _.flatten(await Promise.all(rootChildren.map(cid => categories.getChildrenCids(cid))));
		return [rootCid].concat(rootChildren.concat(childCids));
	}

	// Categories list will be rendered on client side with recursion, etc.
	const cids = await getRootAndChildren();

	let rootParent = 0;
	if (rootCid) {
		rootParent = await categories.getCategoryField(rootCid, 'parentCid') || 0;
	}

	const fields = [
		'cid', 'name', 'nickname', 'icon', 'parentCid', 'disabled', 'link',
		'order', 'color', 'bgColor', 'backgroundImage', 'imageClass',
		'subCategoriesPerPage', 'description', 'descriptionParsed',
	];
	let categoriesData = await categories.getCategoriesFields(cids, fields);
	({ categories: categoriesData } = await plugins.hooks.fire('filter:admin.categories.get', { categories: categoriesData, fields: fields }));

	categoriesData = categoriesData.map((category) => {
		category.isLocal = utils.isNumber(category.cid);
		return category;
	});

	let tree = categories.getTree(categoriesData, rootParent);
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

categoriesController.getFederation = async function (req, res) {
	const cid = req.params.category_id;
	let [_following, pending, followers, name, { selectedCategory }] = await Promise.all([
		db.getSortedSetMembers(`cid:${cid}:following`),
		db.getSortedSetMembers(`followRequests:cid.${cid}`),
		activitypub.notes.getCategoryFollowers(cid),
		categories.getCategoryField(cid, 'name'),
		helpers.getSelectedCategory(cid),
	]);

	const following = [..._following, ...pending].map(entry => ({
		id: entry,
		approved: !pending.includes(entry),
	}));

	await activitypub.actors.assert(followers);
	followers = await user.getUsersFields(followers, ['userslug', 'picture']);

	res.render('admin/manage/category-federation', {
		cid: cid,
		enabled: meta.config.activitypubEnabled,
		name,
		selectedCategory,
		following,
		followers,
	});
};

categoriesController.addRemote = async function (req, res) {
	let { handle, id } = req.body;
	if (handle && !id) {
		({ actorUri: id } = await activitypub.helpers.query(handle));
	}

	if (!id) {
		return res.sendStatus(404);
	}

	await activitypub.actors.assertGroup(id);
	const exists = await categories.exists(id);

	if (!exists) {
		return res.sendStatus(404);
	}

	const score = await db.sortedSetCard('cid:0:children');
	const order = score + 1; // order is 1-based lol
	await Promise.all([
		db.sortedSetAdd('cid:0:children', order, id),
		categories.setCategoryField(id, 'order', order),
	]);
	cache.del('cid:0:children');

	res.sendStatus(200);
};

categoriesController.renameRemote = async (req, res) => {
	if (utils.isNumber(req.params.cid)) {
		return helpers.formatApiResponse(400, res);
	}

	const { name } = req.body;
	await categories.setCategoryField(req.params.cid, 'nickname', name);

	res.sendStatus(200);
};

categoriesController.removeRemote = async function (req, res) {
	if (utils.isNumber(req.params.cid)) {
		return helpers.formatApiResponse(400, res);
	}

	const parentCid = await categories.getCategoryField(req.params.cid, 'parentCid');
	await db.sortedSetRemove(`cid:${parentCid || 0}:children`, req.params.cid);
	cache.del(`cid:${parentCid || 0}:children`);

	res.sendStatus(200);
};
