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

	const templateData = {
		topics: [],
		tag: tag,
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[tags:tags]]', url: '/tags' }, { text: tag }]),
		title: '[[pages:tag, ' + tag + ']]',
	};
	const [settings, cids] = await Promise.all([
		user.getSettings(req.uid),
		categories.getCidsByPrivilege('categories:cid', req.uid, 'topics:read'),
	]);
	const start = Math.max(0, (page - 1) * settings.topicsPerPage);
	const stop = start + settings.topicsPerPage - 1;

	const [topicCount, tids] = await Promise.all([
		topics.getTagTopicCount(tag, cids),
		topics.getTagTidsByCids(tag, cids, start, stop),
	]);

	templateData.topics = await topics.getTopics(tids, req.uid);
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
	templateData.pagination = pagination.create(page, pageCount);
	helpers.addLinkTags({ url: 'tags/' + tag, res: req.res, tags: templateData.pagination.rel });

	templateData['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
	templateData.rssFeedUrl = nconf.get('relative_path') + '/tags/' + tag + '.rss';
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
