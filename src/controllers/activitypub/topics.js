'use strict';

const meta = require('../../meta');
const user = require('../../user');
const topics = require('../../topics');
const posts = require('../../posts');
const categories = require('../../categories');
const privileges = require('../../privileges');
const translator = require('../../translator');
const pagination = require('../../pagination');
const utils = require('../../utils');
const helpers = require('../helpers');

const controller = module.exports;

controller.list = async function (req, res) {
	if (!req.uid && !req.query.sort && !req.query.local) {
		return helpers.redirect(res, '/world?local=1', false);
	}

	const { topicsPerPage } = await user.getSettings(req.uid);
	let { page, after } = req.query;
	page = parseInt(page, 10) || 1;
	let start = Math.max(0, (page - 1) * topicsPerPage);
	let stop = start + topicsPerPage - 1;

	const [userSettings, userPrivileges, isAdminOrGlobalMod, selectedCategory] = await Promise.all([
		user.getSettings(req.uid),
		privileges.categories.get('-1', req.uid),
		user.isAdminOrGlobalMod(req.uid),
		categories.getCategoryData(meta.config.activitypubWorldDefaultCid),
	]);
	const targetUid = await user.getUidByUserslug(req.query.author);
	let cidQuery = {
		uid: req.uid,
		cid: '-1',
		start: start,
		stop: stop,
		after,
		sort: req.query.sort,
		settings: userSettings,
		query: req.query,
		tag: req.query.tag,
		targetUid: targetUid,
		teaserPost: 'last-reply',
		thumbsOnly: 1,
	};
	const data = await categories.getCategoryById(cidQuery);
	delete data.children;
	data.sort = req.query.sort;
	data.privileges = userPrivileges;
	data.selectedCategory = selectedCategory;

	let tids;
	let topicCount;
	let topicData;
	let { local } = req.query;
	local = parseInt(local, 10) === 1;
	if (req.query.sort === 'popular') {
		cidQuery = {
			...cidQuery,
			sort: 'posts',
			term: req.query.term || 'day',
			includeRemote: !local,
			followingOnly: !req.query.all || !parseInt(req.query.all, 10),
		};
		delete cidQuery.cid;
		({ tids, topicCount, topics: topicData } = await topics.getSortedTopics(cidQuery));
		tids = tids.slice(start, stop !== -1 ? stop + 1 : undefined);
	} else {
		cidQuery = {
			...cidQuery,
			term: req.query.term,
			includeRemote: !local,
			followingOnly: !req.query.all || !parseInt(req.query.all, 10),
		};
		delete cidQuery.cid;
		({ tids, topicCount, topics: topicData } = await topics.getSortedTopics(cidQuery));

		/**
		 * Use `after` or `before` cursors (only on IS) to update `start`/`stop`, this is useful
		 * to prevent loading duplicate posts if the sorted topics have received new topics
		 * since the set was last loaded.
		 */
		let cursor = after;
		let direction = 1;
		if (req.query.before) {
			cursor = req.query.before;
			direction = -1;
		}
		if (cursor) {
			const index = tids.indexOf(utils.isNumber(cursor) ? parseInt(cursor, 10) : cursor);
			const count = stop - start + 1;
			if (direction === 1 && index >= start) {
				start = index + 1;
				stop = start + count - 1;
			} else if (direction === -1 && index > 0) {
				stop = index - 1;
				start = stop - count + 1;
			}
		}
		tids = tids.slice(start, stop !== -1 ? stop + 1 : undefined);
	}
	data.topicCount = topicCount;

	const mainPids = await topics.getMainPids(tids);
	const postData = await posts.getPostSummaryByPids(mainPids, req.uid, {
		stripTags: false,
		extraFields: ['bookmarks'],
	});
	const [{ upvotes }, bookmarkStatus] = await Promise.all([
		posts.getVoteStatusByPostIDs(mainPids, req.uid),
		posts.hasBookmarked(mainPids, req.uid),
	]);

	postData.forEach((p, index) => {
		p.pid = encodeURIComponent(p.pid);
		if (p.topic) {
			p.topic = { ...p.topic };
			p.topic.thumbs = topicData[index].thumbs;
			p.topic.postcount = Math.max(0, p.topic.postcount - 1);
			p.topic.teaser = topicData[index].teaser;
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
	data.showTopicTools = isAdminOrGlobalMod;
	data.showSelect = isAdminOrGlobalMod;

	// Tracked/watched categories
	if (req.uid) {
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
	} else {
		data.categories = [];
	}

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
