
'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const pagination = require('../pagination');
const user = require('../user');
const topics = require('../topics');
const helpers = require('./helpers');
const privileges = require('../privileges');

const unreadController = module.exports;
const relative_path = nconf.get('relative_path');

unreadController.get = async function (req, res) {
	const { cid, tag } = req.query;
	const filter = req.query.filter || '';

	const [categoryData, tagData, userSettings, canPost, isPrivileged] = await Promise.all([
		helpers.getSelectedCategory(cid),
		helpers.getSelectedTag(tag),
		user.getSettings(req.uid),
		privileges.categories.canPostTopic(req.uid),
		user.isPrivileged(req.uid),
	]);

	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * userSettings.topicsPerPage);
	const stop = start + userSettings.topicsPerPage - 1;
	const data = await topics.getUnreadTopics({
		cid: cid,
		tag: tag,
		uid: req.uid,
		start: start,
		stop: stop,
		filter: filter,
		query: req.query,
	});

	const isDisplayedAsHome = !(req.originalUrl.startsWith(`${relative_path}/api/unread`) || req.originalUrl.startsWith(`${relative_path}/unread`));
	const baseUrl = isDisplayedAsHome ? '' : 'unread';

	if (isDisplayedAsHome) {
		data.title = meta.config.homePageTitle || '[[pages:home]]';
	} else {
		data.title = '[[pages:unread]]';
		data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
	}

	data.pageCount = Math.max(1, Math.ceil(data.topicCount / userSettings.topicsPerPage));
	data.pagination = pagination.create(page, data.pageCount, req.query);
	helpers.addLinkTags({
		url: 'unread',
		res: req.res,
		tags: data.pagination.rel,
		page: page,
	});

	if (userSettings.usePagination && (page < 1 || page > data.pageCount)) {
		req.query.page = Math.max(1, Math.min(data.pageCount, page));
		return helpers.redirect(res, `/unread?${querystring.stringify(req.query)}`);
	}
	data.canPost = canPost;
	data.showSelect = true;
	data.showTopicTools = isPrivileged;
	data.allCategoriesUrl = `${baseUrl}${helpers.buildQueryString(req.query, 'cid', '')}`;
	data.selectedCategory = categoryData.selectedCategory;
	data.selectedCids = categoryData.selectedCids;
	data.selectCategoryLabel = '[[unread:mark-as-read]]';
	data.selectCategoryIcon = 'fa-inbox';
	data.showCategorySelectLabel = true;
	data.selectedTag = tagData.selectedTag;
	data.selectedTags = tagData.selectedTags;
	data.filters = helpers.buildFilters(baseUrl, filter, req.query);
	data.selectedFilter = data.filters.find(filter => filter && filter.selected);

	res.render('unread', data);
};

unreadController.unreadTotal = async function (req, res, next) {
	const filter = req.query.filter || '';
	try {
		const unreadCount = await topics.getTotalUnread(req.uid, filter);
		res.json(unreadCount);
	} catch (err) {
		next(err);
	}
};
