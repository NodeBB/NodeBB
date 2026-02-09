'use strict';

const _ = require('lodash');

const meta = require('../../meta');
const user = require('../../user');
const topics = require('../../topics');
const posts = require('../../posts');
const categories = require('../../categories');
const translator = require('../../translator');
const pagination = require('../../pagination');
const utils = require('../../utils');
const helpers = require('../helpers');

const controller = module.exports;

controller.list = async function (req, res) {
	if (!req.uid) {
		return helpers.redirect(res, '/recent?cid=-1', false);
	}

	const { topicsPerPage } = await user.getSettings(req.uid);
	const page = parseInt(req.query.page, 10) || 1;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;

	const userSettings = await user.getSettings(req.uid);
	const targetUid = await user.getUidByUserslug(req.query.author);
	let cidQuery = {
		uid: req.uid,
		cid: '-1',
		start: start,
		stop: stop,
		sort: req.query.sort,
		settings: userSettings,
		query: req.query,
		tag: req.query.tag,
		targetUid: targetUid,
	};
	const data = await categories.getCategoryById(cidQuery);
	delete data.children;
	data.sort = req.query.sort;

	let tids;
	let topicCount;
	if (req.query.sort === 'popular') {
		cidQuery = {
			...cidQuery,
			cids: ['-1'],
			sort: 'posts',
			term: req.query.term || 'day',
		};
		delete cidQuery.cid;
		({ tids, topicCount } = await topics.getSortedTopics(cidQuery));
		tids = tids.slice(start, stop !== -1 ? stop + 1 : undefined);
	} else {
		tids = await categories.getTopicIds(cidQuery);
		topicCount = await categories.getTopicCount(cidQuery);
	}
	data.topicCount = topicCount;

	const mainPids = await topics.getMainPids(tids);
	const postData = await posts.getPostSummaryByPids(mainPids, req.uid, {
		stripTags: false,
		extraFields: ['bookmarks'],
	});
	const uniqTids = _.uniq(postData.map(p => p.tid));
	const [topicData, { upvotes }, bookmarkStatus] = await Promise.all([
		topics.getTopicsFields(uniqTids, ['tid', 'numThumbs', 'thumbs', 'mainPid']),
		posts.getVoteStatusByPostIDs(mainPids, req.uid),
		posts.hasBookmarked(mainPids, req.uid),
	]);

	const thumbs = await topics.thumbs.load(topicData);
	const tidToThumbs = _.zipObject(uniqTids, thumbs);
	const teasers = await topics.getTeasers(postData.map(p => p.topic), { uid: req.uid });
	postData.forEach((p, index) => {
		p.pid = encodeURIComponent(p.pid);
		if (p.topic) {
			p.topic = { ...p.topic };
			p.topic.thumbs = tidToThumbs[p.tid];
			p.topic.postcount = Math.max(0, p.topic.postcount - 1);
			p.topic.teaser = teasers[index];
		}
		p.upvoted = upvotes[index];
		p.bookmarked = bookmarkStatus[index];
		if (!p.isMainPost) {
			p.repliedString = translator.compile('feed:replied-in-ago', p.topic.title, p.timestampISO);
		}
		p.index = start + index;
	});
	data.showThumbs = req.loggedIn || meta.config.privateUploads !== 1;
	data.posts = postData;
	data.showTopicTools = true;
	data.showSelect = true;

	// Tracked/watched categories
	let cids = await user.getCategoriesByStates(req.uid, [
		categories.watchStates.tracking, categories.watchStates.watching,
	]);
	cids = cids.filter(cid => !utils.isNumber(cid));
	const [categoryData, watchState] = await Promise.all([
		categories.getCategories(cids),
		categories.getWatchState(cids, req.uid),
	]);
	data.categories = categories.getTree(categoryData, 0);
	await Promise.all([
		categories.getRecentTopicReplies(categoryData, req.uid, req.query),
		categories.setUnread(data.categories, cids, req.uid),
	]);
	data.categories.forEach((category, idx) => {
		if (category) {
			helpers.trimChildren(category);
			helpers.setCategoryTeaser(category);
			category.isWatched = watchState[idx] === categories.watchStates.watching;
			category.isTracked = watchState[idx] === categories.watchStates.tracking;
			category.isNotWatched = watchState[idx] === categories.watchStates.notwatching;
			category.isIgnored = watchState[idx] === categories.watchStates.ignoring;
		}
	});

	data.title = translator.escape(data.name);
	data.breadcrumbs = helpers.buildBreadcrumbs([]);

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
