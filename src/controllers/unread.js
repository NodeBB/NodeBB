
'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const pagination = require('../pagination');
const user = require('../user');
const topics = require('../topics');
const helpers = require('./helpers');

const unreadController = module.exports;

unreadController.get = async function (req, res) {
	const cid = req.query.cid;
	const filter = req.query.filter || '';

	const [categoryData, userSettings, isPrivileged] = await Promise.all([
		helpers.getSelectedCategory(cid),
		user.getSettings(req.uid),
		user.isPrivileged(req.uid),
	]);

	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * userSettings.topicsPerPage);
	const stop = start + userSettings.topicsPerPage - 1;
	const data = await topics.getUnreadTopics({
		cid: cid,
		uid: req.uid,
		start: start,
		stop: stop,
		filter: filter,
		query: req.query,
	});

	data.title = meta.config.homePageTitle || '[[pages:home]]';
	data.pageCount = Math.max(1, Math.ceil(data.topicCount / userSettings.topicsPerPage));
	data.pagination = pagination.create(page, data.pageCount, req.query);
	helpers.addLinkTags({ url: 'unread', res: req.res, tags: data.pagination.rel });

	if (userSettings.usePagination && (page < 1 || page > data.pageCount)) {
		req.query.page = Math.max(1, Math.min(data.pageCount, page));
		return helpers.redirect(res, '/unread?' + querystring.stringify(req.query));
	}
	data.showSelect = true;
	data.showTopicTools = isPrivileged;
	data.allCategoriesUrl = 'unread' + helpers.buildQueryString(req.query, 'cid', '');
	data.selectedCategory = categoryData.selectedCategory;
	data.selectedCids = categoryData.selectedCids;
	data.selectCategoryLabel = '[[unread:mark_as_read]]';
	if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/unread') || req.originalUrl.startsWith(nconf.get('relative_path') + '/unread')) {
		data.title = '[[pages:unread]]';
		data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[unread:title]]' }]);
	}

	data.filters = helpers.buildFilters('unread', filter, req.query);

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
