'use strict';

const nconf = require('nconf');

const user = require('../../user');
const topics = require('../../topics');
const categories = require('../../categories');
const privileges = require('../../privileges');
const translator = require('../../translator');
const meta = require('../../meta');
const pagination = require('../../pagination');
const utils = require('../../utils');
const helpers = require('../helpers');

const controller = module.exports;

const validSorts = [
	'recently_replied', 'recently_created', 'most_posts', 'most_votes', 'most_views',
];

controller.list = async function (req, res) {
	if (!req.uid) {
		return helpers.redirect(res, '/recent?cid=-1', false);
	}

	const { topicsPerPage } = await user.getSettings(req.uid);
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;

	const [userPrivileges, tagData, userSettings, rssToken] = await Promise.all([
		privileges.categories.get('-1', req.uid),
		helpers.getSelectedTag(req.query.tag),
		user.getSettings(req.uid),
		user.auth.getFeedToken(req.uid),
	]);
	const sort = validSorts.includes(req.query.sort) ? req.query.sort : userSettings.categoryTopicSort;
	const targetUid = await user.getUidByUserslug(req.query.author);
	const cidQuery = {
		uid: req.uid,
		cid: '-1',
		start: start,
		stop: stop,
		sort: sort,
		settings: userSettings,
		query: req.query,
		tag: req.query.tag,
		targetUid: targetUid,
	};
	const data = await categories.getCategoryById(cidQuery);
	delete data.children;

	let tids = await categories.getTopicIds(cidQuery);
	tids = await categories.sortTidsBySet(tids, sort); // sorting not handled if cid is -1
	data.topicCount = tids.length;
	data.topics = await topics.getTopicsByTids(tids, { uid: req.uid });
	topics.calculateTopicIndices(data.topics, start);

	// Tracked/watched categories
	let cids = await user.getCategoriesByStates(req.uid, [
		categories.watchStates.tracking, categories.watchStates.watching,
	]);
	cids = cids.filter(cid => !utils.isNumber(cid));
	const categoryData = await categories.getCategories(cids);
	data.categories = categories.getTree(categoryData, 0);
	await Promise.all([
		categories.getRecentTopicReplies(categoryData, req.uid, req.query),
		categories.setUnread(data.categories, cids, req.uid),
	]);
	data.categories.forEach((category) => {
		if (category) {
			helpers.trimChildren(category);
			helpers.setCategoryTeaser(category);
		}
	});

	data.title = translator.escape(data.name);
	data.privileges = userPrivileges;
	data.selectedTag = tagData.selectedTag;
	data.selectedTags = tagData.selectedTags;

	data.breadcrumbs = helpers.buildBreadcrumbs([{ text: `[[pages:world]]` }]);
	data['feeds:disableRSS'] = meta.config['feeds:disableRSS'] || 0;
	data['reputation:disabled'] = meta.config['reputation:disabled'];
	if (!meta.config['feeds:disableRSS']) {
		data.rssFeedUrl = `${nconf.get('url')}/category/${data.cid}.rss`;
		if (req.loggedIn) {
			data.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
		}
	}

	const pageCount = Math.max(1, Math.ceil(data.topicCount / topicsPerPage));
	data.pagination = pagination.create(page, pageCount, req.query);
	helpers.addLinkTags({
		url: 'world',
		res: req.res,
		tags: data.pagination.rel,
		page: page,
	});

	res.render('world', data);
};
