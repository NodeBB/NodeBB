'use strict';

const nconf = require('nconf');
const _ = require('lodash');

const categories = require('../categories');
const meta = require('../meta');
const pagination = require('../pagination');
const helpers = require('./helpers');
const privileges = require('../privileges');

const categoriesController = module.exports;

categoriesController.list = async function (req, res) {
	res.locals.metaTags = [{
		name: 'title',
		content: String(meta.config.title || 'NodeBB'),
	}, {
		property: 'og:type',
		content: 'website',
	}];

	const allRootCids = await categories.getAllCidsFromSet('cid:0:children');
	const rootCids = await privileges.categories.filterCids('find', allRootCids, req.uid);
	const pageCount = Math.max(1, Math.ceil(rootCids.length / meta.config.categoriesPerPage));
	const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
	const start = Math.max(0, (page - 1) * meta.config.categoriesPerPage);
	const stop = start + meta.config.categoriesPerPage - 1;
	const pageCids = rootCids.slice(start, stop + 1);

	const allChildCids = _.flatten(await Promise.all(pageCids.map(cid => categories.getChildrenCids(cid))));
	const childCids = await privileges.categories.filterCids('find', allChildCids, req.uid);
	const categoryData = await categories.getCategories(pageCids.concat(childCids), req.uid);
	const tree = categories.getTree(categoryData, 0);
	await categories.getRecentTopicReplies(categoryData, req.uid, req.query);

	const data = {
		title: meta.config.homePageTitle || '[[pages:home]]',
		categories: tree,
		pagination: pagination.create(page, pageCount, req.query),
	};

	data.categories.forEach(function (category) {
		if (category) {
			if (Array.isArray(category.children)) {
				category.children = category.children.slice(0, category.subCategoriesPerPage);
				category.children.forEach(function (child) {
					child.children = undefined;
				});
			}
			if (Array.isArray(category.posts) && category.posts.length && category.posts[0]) {
				category.teaser = {
					url: nconf.get('relative_path') + '/post/' + category.posts[0].pid,
					timestampISO: category.posts[0].timestampISO,
					pid: category.posts[0].pid,
					topic: category.posts[0].topic,
				};
			}
		}
	});

	if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/categories') || req.originalUrl.startsWith(nconf.get('relative_path') + '/categories')) {
		data.title = '[[pages:categories]]';
		data.breadcrumbs = helpers.buildBreadcrumbs([{ text: data.title }]);
		res.locals.metaTags.push({
			property: 'og:title',
			content: '[[pages:categories]]',
		});
	}

	res.render('categories', data);
};
