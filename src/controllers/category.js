'use strict';


const nconf = require('nconf');

const db = require('../database');
const privileges = require('../privileges');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const pagination = require('../pagination');
const helpers = require('./helpers');
const utils = require('../utils');
const translator = require('../translator');
const analytics = require('../analytics');

const categoryController = module.exports;

categoryController.get = async function (req, res, next) {
	const cid = req.params.category_id;

	let currentPage = parseInt(req.query.page, 10) || 1;
	let topicIndex = utils.isNumber(req.params.topic_index) ? parseInt(req.params.topic_index, 10) - 1 : 0;
	if ((req.params.topic_index && !utils.isNumber(req.params.topic_index)) || !utils.isNumber(cid)) {
		return next();
	}

	const [categoryFields, userPrivileges, userSettings, rssToken] = await Promise.all([
		categories.getCategoryFields(cid, ['slug', 'disabled']),
		privileges.categories.get(cid, req.uid),
		user.getSettings(req.uid),
		user.auth.getFeedToken(req.uid),
	]);

	if (!categoryFields.slug ||
		(categoryFields && categoryFields.disabled) ||
		(userSettings.usePagination && currentPage < 1) ||
		topicIndex < 0) {
		return next();
	}

	if (!userPrivileges.read) {
		return helpers.notAllowed(req, res);
	}

	if (!res.locals.isAPI && (!req.params.slug || categoryFields.slug !== cid + '/' + req.params.slug) && (categoryFields.slug && categoryFields.slug !== cid + '/')) {
		return helpers.redirect(res, '/category/' + categoryFields.slug, true);
	}


	if (!userSettings.usePagination) {
		topicIndex = Math.max(0, topicIndex - (Math.ceil(userSettings.topicsPerPage / 2) - 1));
	} else if (!req.query.page) {
		const index = Math.max(parseInt((topicIndex || 0), 10), 0);
		currentPage = Math.ceil((index + 1) / userSettings.topicsPerPage);
		topicIndex = 0;
	}

	const targetUid = await user.getUidByUserslug(req.query.author);
	const start = ((currentPage - 1) * userSettings.topicsPerPage) + topicIndex;
	const stop = start + userSettings.topicsPerPage - 1;

	const categoryData = await categories.getCategoryById({
		uid: req.uid,
		cid: cid,
		start: start,
		stop: stop,
		sort: req.query.sort || userSettings.categoryTopicSort,
		settings: userSettings,
		query: req.query,
		tag: req.query.tag,
		targetUid: targetUid,
	});
	if (!categoryData) {
		return next();
	}

	if (topicIndex > Math.max(categoryData.topic_count - 1, 0)) {
		return helpers.redirect(res, '/category/' + categoryData.slug + '/' + categoryData.topic_count);
	}
	const pageCount = Math.max(1, Math.ceil(categoryData.topic_count / userSettings.topicsPerPage));
	if (userSettings.usePagination && currentPage > pageCount) {
		return next();
	}

	categories.modifyTopicsByPrivilege(categoryData.topics, userPrivileges);
	if (categoryData.link) {
		await db.incrObjectField('category:' + categoryData.cid, 'timesClicked');
		return helpers.redirect(res, categoryData.link);
	}
	await buildBreadcrumbs(req, categoryData);
	if (categoryData.children.length) {
		const allCategories = [];
		categories.flattenCategories(allCategories, categoryData.children);
		await categories.getRecentTopicReplies(allCategories, req.uid, req.query);
	}

	categoryData.title = translator.escape(categoryData.name);
	categoryData.description = translator.escape(categoryData.description);
	categoryData.privileges = userPrivileges;
	categoryData.showSelect = userPrivileges.editable;
	categoryData.showTopicTools = userPrivileges.editable;
	categoryData.topicIndex = topicIndex;
	categoryData.rssFeedUrl = nconf.get('url') + '/category/' + categoryData.cid + '.rss';
	if (parseInt(req.uid, 10)) {
		categories.markAsRead([cid], req.uid);
		categoryData.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
	}

	addTags(categoryData, res);

	categoryData['feeds:disableRSS'] = meta.config['feeds:disableRSS'] || 0;
	categoryData['reputation:disabled'] = meta.config['reputation:disabled'];
	categoryData.pagination = pagination.create(currentPage, pageCount, req.query);
	categoryData.pagination.rel.forEach(function (rel) {
		rel.href = nconf.get('url') + '/category/' + categoryData.slug + rel.href;
		res.locals.linkTags.push(rel);
	});

	analytics.increment(['pageviews:byCid:' + categoryData.cid]);

	res.render('category', categoryData);
};

async function buildBreadcrumbs(req, categoryData) {
	const breadcrumbs = [
		{
			text: categoryData.name,
			url: nconf.get('relative_path') + '/category/' + categoryData.slug,
			cid: categoryData.cid,
		},
	];
	const crumbs = await helpers.buildCategoryBreadcrumbs(categoryData.parentCid);
	if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/category') || req.originalUrl.startsWith(nconf.get('relative_path') + '/category')) {
		categoryData.breadcrumbs = crumbs.concat(breadcrumbs);
	}
}

function addTags(categoryData, res) {
	res.locals.metaTags = [
		{
			name: 'title',
			content: categoryData.name,
		},
		{
			property: 'og:title',
			content: categoryData.name,
		},
		{
			name: 'description',
			content: categoryData.description,
		},
		{
			property: 'og:type',
			content: 'website',
		},
	];

	if (categoryData.backgroundImage) {
		if (!categoryData.backgroundImage.startsWith('http')) {
			categoryData.backgroundImage = nconf.get('url') + categoryData.backgroundImage;
		}
		res.locals.metaTags.push({
			property: 'og:image',
			content: categoryData.backgroundImage,
		});
	}

	res.locals.linkTags = [
		{
			rel: 'up',
			href: nconf.get('url'),
		},
	];

	if (!categoryData['feeds:disableRSS']) {
		res.locals.linkTags.push({
			rel: 'alternate',
			type: 'application/rss+xml',
			href: categoryData.rssFeedUrl,
		});
	}
}
