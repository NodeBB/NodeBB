'use strict';

const rss = require('rss');
const nconf = require('nconf');
const validator = require('validator');

const posts = require('../posts');
const topics = require('../topics');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const controllerHelpers = require('../controllers/helpers');
const privileges = require('../privileges');
const db = require('../database');
const utils = require('../utils');
const controllers404 = require('../controllers/404');
const routeHelpers = require('./helpers');

const terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
	alltime: 'alltime',
};

module.exports = function (app, middleware) {
	app.get('/topic/:topic_id.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForTopic));
	app.get('/category/:category_id.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForCategory));
	app.get('/topics.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForTopics));
	app.get('/recent.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForRecent));
	app.get('/top.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForTop));
	app.get('/top/:term.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForTop));
	app.get('/popular.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForPopular));
	app.get('/popular/:term.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForPopular));
	app.get('/recentposts.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForRecentPosts));
	app.get('/category/:category_id/recentposts.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForCategoryRecentPosts));
	app.get('/user/:userslug/topics.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForUserTopics));
	app.get('/tags/:tag.rss', middleware.maintenanceMode, routeHelpers.tryRoute(generateForTag));
};

async function validateTokenIfRequiresLogin(requiresLogin, cid, req, res) {
	const uid = parseInt(req.query.uid, 10) || 0;
	const { token } = req.query;

	if (!requiresLogin) {
		return true;
	}

	if (uid <= 0 || !token) {
		return controllerHelpers.notAllowed(req, res);
	}
	const userToken = await db.getObjectField(`user:${uid}`, 'rss_token');
	if (userToken !== token) {
		await user.auth.logAttempt(uid, req.ip);
		return controllerHelpers.notAllowed(req, res);
	}
	const userPrivileges = await privileges.categories.get(cid, uid);
	if (!userPrivileges.read) {
		return controllerHelpers.notAllowed(req, res);
	}
	return true;
}

async function generateForTopic(req, res, next) {
	if (meta.config['feeds:disableRSS']) {
		return next();
	}

	const tid = req.params.topic_id;

	const [userPrivileges, topic] = await Promise.all([
		privileges.topics.get(tid, req.uid),
		topics.getTopicData(tid),
	]);

	if (!privileges.topics.canViewDeletedScheduled(topic, userPrivileges)) {
		return next();
	}

	if (await validateTokenIfRequiresLogin(!userPrivileges['topics:read'], topic.cid, req, res)) {
		const topicData = await topics.getTopicWithPosts(topic, `tid:${tid}:posts`, req.uid || req.query.uid || 0, 0, 24, true);

		topics.modifyPostsByPrivilege(topicData, userPrivileges);

		const feed = new rss({
			title: utils.stripHTMLTags(topicData.title, utils.tags),
			description: topicData.posts.length ? topicData.posts[0].content : '',
			feed_url: `${nconf.get('url')}/topic/${tid}.rss`,
			site_url: `${nconf.get('url')}/topic/${topicData.slug}`,
			image_url: topicData.posts.length ? topicData.posts[0].picture : '',
			author: topicData.posts.length ? topicData.posts[0].username : '',
			ttl: 60,
		});

		if (topicData.posts.length > 0) {
			feed.pubDate = new Date(parseInt(topicData.posts[0].timestamp, 10)).toUTCString();
		}
		const replies = topicData.posts.slice(1);
		replies.forEach((postData) => {
			if (!postData.deleted) {
				const dateStamp = new Date(
					parseInt(parseInt(postData.edited, 10) === 0 ? postData.timestamp : postData.edited, 10)
				).toUTCString();

				feed.item({
					title: `Reply to ${utils.stripHTMLTags(topicData.title, utils.tags)} on ${dateStamp}`,
					description: postData.content,
					url: `${nconf.get('url')}/post/${postData.pid}`,
					author: postData.user ? postData.user.username : '',
					date: dateStamp,
				});
			}
		});

		sendFeed(feed, res);
	}
}

async function generateForCategory(req, res, next) {
	const cid = req.params.category_id;
	if (meta.config['feeds:disableRSS'] || !parseInt(cid, 10)) {
		return next();
	}
	const uid = req.uid || req.query.uid || 0;
	const [userPrivileges, category, tids] = await Promise.all([
		privileges.categories.get(cid, req.uid),
		categories.getCategoryData(cid),
		db.getSortedSetRevIntersect({
			sets: ['topics:tid', `cid:${cid}:tids:lastposttime`],
			start: 0,
			stop: 24,
			weights: [1, 0],
		}),
	]);

	if (!category || !category.name) {
		return next();
	}

	if (await validateTokenIfRequiresLogin(!userPrivileges.read, cid, req, res)) {
		let topicsData = await topics.getTopicsByTids(tids, uid);
		topicsData = await user.blocks.filter(uid, topicsData);
		const feed = await generateTopicsFeed({
			uid: uid,
			title: category.name,
			description: category.description,
			feed_url: `/category/${cid}.rss`,
			site_url: `/category/${category.cid}`,
		}, topicsData, 'timestamp');

		sendFeed(feed, res);
	}
}

async function generateForTopics(req, res, next) {
	if (meta.config['feeds:disableRSS']) {
		return next();
	}
	const uid = await getUidFromToken(req);

	await sendTopicsFeed({
		uid: uid,
		title: 'Most recently created topics',
		description: 'A list of topics that have been created recently',
		feed_url: '/topics.rss',
		useMainPost: true,
	}, 'topics:tid', res);
}

async function generateForRecent(req, res, next) {
	await generateSorted({
		title: 'Recently Active Topics',
		description: 'A list of topics that have been active within the past 24 hours',
		feed_url: '/recent.rss',
		site_url: '/recent',
		sort: 'recent',
		timestampField: 'lastposttime',
		term: 'alltime',
	}, req, res, next);
}

async function generateForTop(req, res, next) {
	await generateSorted({
		title: 'Top Voted Topics',
		description: 'A list of topics that have received the most votes',
		feed_url: `/top/${req.params.term || 'daily'}.rss`,
		site_url: `/top/${req.params.term || 'daily'}`,
		sort: 'votes',
		timestampField: 'timestamp',
		term: 'day',
	}, req, res, next);
}

async function generateForPopular(req, res, next) {
	await generateSorted({
		title: 'Popular Topics',
		description: 'A list of topics that are sorted by post count',
		feed_url: `/popular/${req.params.term || 'daily'}.rss`,
		site_url: `/popular/${req.params.term || 'daily'}`,
		sort: 'posts',
		timestampField: 'timestamp',
		term: 'day',
	}, req, res, next);
}

async function generateSorted(options, req, res, next) {
	if (meta.config['feeds:disableRSS']) {
		return next();
	}

	const term = terms[req.params.term] || options.term;
	const uid = await getUidFromToken(req);

	const params = {
		uid: uid,
		start: 0,
		stop: 19,
		term: term,
		sort: options.sort,
	};

	const { cid } = req.query;
	if (cid) {
		if (!await privileges.categories.can('topics:read', cid, uid)) {
			return controllerHelpers.notAllowed(req, res);
		}
		params.cids = [cid];
	}

	const result = await topics.getSortedTopics(params);
	const feed = await generateTopicsFeed({
		uid: uid,
		title: options.title,
		description: options.description,
		feed_url: options.feed_url,
		site_url: options.site_url,
	}, result.topics, options.timestampField);

	sendFeed(feed, res);
}

async function sendTopicsFeed(options, set, res, timestampField) {
	const start = options.hasOwnProperty('start') ? options.start : 0;
	const stop = options.hasOwnProperty('stop') ? options.stop : 19;
	const topicData = await topics.getTopicsFromSet(set, options.uid, start, stop);
	const feed = await generateTopicsFeed(options, topicData.topics, timestampField);
	sendFeed(feed, res);
}

async function generateTopicsFeed(feedOptions, feedTopics, timestampField) {
	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	feedTopics = feedTopics.filter(Boolean);

	const feed = new rss(feedOptions);

	if (feedTopics.length > 0) {
		feed.pubDate = new Date(feedTopics[0][timestampField]).toUTCString();
	}

	async function addFeedItem(topicData) {
		const feedItem = {
			title: utils.stripHTMLTags(topicData.title, utils.tags),
			url: `${nconf.get('url')}/topic/${topicData.slug}`,
			date: new Date(topicData[timestampField]).toUTCString(),
		};

		if (topicData.deleted) {
			return;
		}

		if (topicData.teaser && topicData.teaser.user && !feedOptions.useMainPost) {
			feedItem.description = topicData.teaser.content;
			feedItem.author = topicData.teaser.user.username;
			feed.item(feedItem);
			return;
		}

		const mainPost = await topics.getMainPost(topicData.tid, feedOptions.uid);
		if (!mainPost) {
			feed.item(feedItem);
			return;
		}
		feedItem.description = mainPost.content;
		feedItem.author = mainPost.user && mainPost.user.username;
		feed.item(feedItem);
	}

	for (const topicData of feedTopics) {
		/* eslint-disable no-await-in-loop */
		await addFeedItem(topicData);
	}
	return feed;
}

async function generateForRecentPosts(req, res, next) {
	if (meta.config['feeds:disableRSS']) {
		return next();
	}
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const postData = await posts.getRecentPosts(req.uid, start, stop, 'month');
	const feed = generateForPostsFeed({
		title: 'Recent Posts',
		description: 'A list of recent posts',
		feed_url: '/recentposts.rss',
		site_url: '/recentposts',
	}, postData);

	sendFeed(feed, res);
}

async function generateForCategoryRecentPosts(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.handle404(req, res);
	}
	const cid = req.params.category_id;
	const page = parseInt(req.query.page, 10) || 1;
	const topicsPerPage = 20;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;
	const [userPrivileges, category, postData] = await Promise.all([
		privileges.categories.get(cid, req.uid),
		categories.getCategoryData(cid),
		categories.getRecentReplies(cid, req.uid || req.query.uid || 0, start, stop),
	]);

	if (!category) {
		return controllers404.handle404(req, res);
	}

	if (await validateTokenIfRequiresLogin(!userPrivileges.read, cid, req, res)) {
		const feed = generateForPostsFeed({
			title: `${category.name} Recent Posts`,
			description: `A list of recent posts from ${category.name}`,
			feed_url: `/category/${cid}/recentposts.rss`,
			site_url: `/category/${cid}/recentposts`,
		}, postData);

		sendFeed(feed, res);
	}
}

function generateForPostsFeed(feedOptions, posts) {
	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	const feed = new rss(feedOptions);

	if (posts.length > 0) {
		feed.pubDate = new Date(parseInt(posts[0].timestamp, 10)).toUTCString();
	}

	posts.forEach((postData) => {
		feed.item({
			title: postData.topic ? postData.topic.title : '',
			description: postData.content,
			url: `${nconf.get('url')}/post/${postData.pid}`,
			author: postData.user ? postData.user.username : '',
			date: new Date(parseInt(postData.timestamp, 10)).toUTCString(),
		});
	});

	return feed;
}

async function generateForUserTopics(req, res, next) {
	if (meta.config['feeds:disableRSS']) {
		return next();
	}

	const { userslug } = req.params;
	const uid = await user.getUidByUserslug(userslug);
	if (!uid) {
		return next();
	}
	const userData = await user.getUserFields(uid, ['uid', 'username']);
	await sendTopicsFeed({
		uid: req.uid,
		title: `Topics by ${userData.username}`,
		description: `A list of topics that are posted by ${userData.username}`,
		feed_url: `/user/${userslug}/topics.rss`,
		site_url: `/user/${userslug}/topics`,
	}, `uid:${userData.uid}:topics`, res);
}

async function generateForTag(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.handle404(req, res);
	}
	const uid = await getUidFromToken(req);
	const tag = validator.escape(String(req.params.tag));
	const page = parseInt(req.query.page, 10) || 1;
	const topicsPerPage = meta.config.topicsPerPage || 20;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;
	await sendTopicsFeed({
		uid: uid,
		title: `Topics tagged with ${tag}`,
		description: `A list of topics that have been tagged with ${tag}`,
		feed_url: `/tags/${tag}.rss`,
		site_url: `/tags/${tag}`,
		start: start,
		stop: stop,
	}, `tag:${tag}:topics`, res);
}

async function getUidFromToken(req) {
	let token = null;
	if (req.query.token && req.query.uid) {
		token = await db.getObjectField(`user:${req.query.uid}`, 'rss_token');
	}

	return token && token === req.query.token ? req.query.uid : req.uid;
}

function sendFeed(feed, res) {
	const xml = feed.xml();
	res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
}
