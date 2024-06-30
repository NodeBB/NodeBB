'use strict';

const nconf = require('nconf');

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');

const pagination = require('../../pagination');
const helpers = require('../helpers');

const categories = require('../../categories');
const privileges = require('../../privileges');
const translator = require('../../translator');
const meta = require('../../meta');

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

	const sortToSet = {
		recently_replied: `cid:-1:tids`,
		recently_created: `cid:-1:tids:create`,
		most_posts: `cid:-1:tids:posts`,
		most_votes: `cid:-1:tids:votes`,
		most_views: `cid:-1:tids:views`,
	};

	const [userPrivileges, tagData, userSettings, rssToken] = await Promise.all([
		privileges.categories.get('-1', req.uid),
		helpers.getSelectedTag(req.query.tag),
		user.getSettings(req.uid),
		user.auth.getFeedToken(req.uid),
	]);
	const sort = validSorts.includes(req.query.sort) ? req.query.sort : userSettings.categoryTopicSort;

	const sets = [sortToSet[sort], `uid:${req.uid}:inbox`];
	const tids = await db.getSortedSetRevIntersect({
		sets,
		start,
		stop,
		weights: sets.map((s, index) => (index ? 0 : 1)),
	});

	const targetUid = await user.getUidByUserslug(req.query.author);

	const data = await categories.getCategoryById({
		uid: req.uid,
		cid: '-1',
		start: start,
		stop: stop,
		sort: sort,
		settings: userSettings,
		query: req.query,
		tag: req.query.tag,
		targetUid: targetUid,
	});
	data.name = '[[activitypub:world.name]]';
	delete data.children;

	data.topicCount = await db.sortedSetIntersectCard(sets);
	data.topics = await topics.getTopicsByTids(tids, { uid: req.uid });
	topics.calculateTopicIndices(data.topics, start);

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
