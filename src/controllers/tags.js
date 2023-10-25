'use strict';

const validator = require('validator');
const nconf = require('nconf');

const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const topics = require('../topics');
const privileges = require('../privileges');
const pagination = require('../pagination');
const utils = require('../utils');
const helpers = require('./helpers');

const tagsController = module.exports;

tagsController.getTag = async function (req, res) {
	const tag = validator.escape(utils.cleanUpTag(req.params.tag, meta.config.maximumTagLength));
	const page = parseInt(req.query.page, 10) || 1;
	const cid = Array.isArray(req.query.cid) || !req.query.cid ? req.query.cid : [req.query.cid];

	const templateData = {
		topics: [],
		tag: tag,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]', url: '/tags' }, { text: tag }]),
		title: `[[pages:tag, ${tag}]]`,
	};
	const [settings, cids, categoryData, canPost, isPrivileged, rssToken, isFollowing] = await Promise.all([
		user.getSettings(req.uid),
		cid || categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read'),
		helpers.getSelectedCategory(cid),
		privileges.categories.canPostTopic(req.uid),
		user.isPrivileged(req.uid),
		user.auth.getFeedToken(req.uid),
		topics.isFollowingTag(req.params.tag, req.uid),
	]);
	const start = Math.max(0, (page - 1) * settings.topicsPerPage);
	const stop = start + settings.topicsPerPage - 1;

	const [topicCount, tids] = await Promise.all([
		topics.getTagTopicCount(tag, cids),
		topics.getTagTidsByCids(tag, cids, start, stop),
	]);

	templateData.topics = await topics.getTopics(tids, req.uid);
	templateData.canPost = canPost;
	templateData.showSelect = isPrivileged;
	templateData.showTopicTools = isPrivileged;
	templateData.isFollowing = isFollowing;
	templateData.allCategoriesUrl = `tags/${tag}${helpers.buildQueryString(req.query, 'cid', '')}`;
	templateData.selectedCategory = categoryData.selectedCategory;
	templateData.selectedCids = categoryData.selectedCids;
	topics.calculateTopicIndices(templateData.topics, start);
	res.locals.metaTags = [
		{
			name: 'title',
			content: tag,
		},
		{
			property: 'og:title',
			content: tag,
		},
	];

	const pageCount = Math.max(1, Math.ceil(topicCount / settings.topicsPerPage));
	templateData.pagination = pagination.create(page, pageCount, req.query);
	helpers.addLinkTags({
		url: `tags/${tag}`,
		res: req.res,
		tags: templateData.pagination.rel,
		page: page,
	});

	templateData['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
	if (!meta.config['feeds:disableRSS']) {
		templateData.rssFeedUrl = `${nconf.get('relative_path')}/tags/${tag}.rss`;
		if (req.loggedIn) {
			templateData.rssFeedUrl += `?uid=${req.uid}&token=${rssToken}`;
		}
	}

	res.render('tag', templateData);
};

tagsController.getTags = async function (req, res) {
	const cids = await categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read');
	const [canSearch, tags] = await Promise.all([
		privileges.global.can('search:tags', req.uid),
		topics.getCategoryTagsData(cids, 0, 99),
	]);

	res.render('tags', {
		tags: tags.filter(Boolean),
		displayTagSearch: canSearch,
		nextStart: 100,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]' }]),
		title: '[[pages:tags]]',
	});
};
