'use strict';

const rss = require('rss');
const nconf = require('nconf');
const validator = require('validator');

const posts = require('../posts');
const topics = require('../topics');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const helpers = require('../controllers/helpers');
const privileges = require('../privileges');
const db = require('../database');
const utils = require('../utils');
const controllers404 = require('../controllers/404.js');

const terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
	alltime: 'alltime',
};

module.exports = function (app, middleware) {
	app.get('/topic/:topic_id.rss', middleware.maintenanceMode, generateForTopic);
	app.get('/category/:category_id.rss', middleware.maintenanceMode, generateForCategory);
	app.get('/topics.rss', middleware.maintenanceMode, generateForTopics);
	app.get('/recent.rss', middleware.maintenanceMode, generateForRecent);
	app.get('/top.rss', middleware.maintenanceMode, generateForTop);
	app.get('/top/:term.rss', middleware.maintenanceMode, generateForTop);
	app.get('/popular.rss', middleware.maintenanceMode, generateForPopular);
	app.get('/popular/:term.rss', middleware.maintenanceMode, generateForPopular);
	app.get('/recentposts.rss', middleware.maintenanceMode, generateForRecentPosts);
	app.get('/category/:category_id/recentposts.rss', middleware.maintenanceMode, generateForCategoryRecentPosts);
	app.get('/user/:userslug/topics.rss', middleware.maintenanceMode, generateForUserTopics);
	app.get('/tags/:tag.rss', middleware.maintenanceMode, generateForTag);
};

async function validateTokenIfRequiresLogin(requiresLogin, cid, req, res) {
	const uid = parseInt(req.query.uid, 10) || 0;
	const token = req.query.token;

	if (!requiresLogin) {
		return true;
	}

	if (uid <= 0 || !token) {
		return helpers.notAllowed(req, res);
	}
	const userToken = await db.getObjectField(`user:${uid}`, 'rss_token');
	if (userToken !== token) {
		await user.auth.logAttempt(uid, req.ip);
		return helpers.notAllowed(req, res);
	}
	const userPrivileges = await privileges.categories.get(cid, uid);
	if (!userPrivileges.read) {
		return helpers.notAllowed(req, res);
	}
	return true;
}

async function generateForTopic(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}

	const tid = req.params.topic_id;

	const [userPrivileges, topic] = await Promise.all([
		privileges.topics.get(tid, req.uid),
		topics.getTopicData(tid),
	]);

	if (!topic || (topic.deleted && !userPrivileges.view_deleted)) {
		return controllers404.send404(req, res);
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
				const dateStamp = new Date(parseInt(parseInt(postData.edited, 10) === 0 ? postData.timestamp : postData.edited, 10)).toUTCString();

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
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}
	const cid = req.params.category_id;
	if (!parseInt(cid, 10)) {
		return next();
	}

	const [userPrivileges, category] = await Promise.all([
		privileges.categories.get(cid, req.uid),
		categories.getCategoryById({
			cid: cid,
			set: `cid:${cid}:tids`,
			reverse: true,
			start: 0,
			stop: 25,
			uid: req.uid || req.query.uid || 0,
		}),
	]);

	if (!category) {
		return next();
	}

	if (await validateTokenIfRequiresLogin(!userPrivileges.read, cid, req, res)) {
		const feed = await generateTopicsFeed({
			uid: req.uid || req.query.uid || 0,
			title: category.name,
			description: category.description,
			feed_url: `/category/${cid}.rss`,
			site_url: `/category/${category.cid}`,
		}, category.topics);

		sendFeed(feed, res);
	}
}

async function generateForTopics(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}
	let token = null;
	if (req.query.token && req.query.uid) {
		token = await db.getObjectField(`user:${req.query.uid}`, 'rss_token');
	}

	await sendTopicsFeed({
		uid: token && token === req.query.token ? req.query.uid : req.uid,
		title: 'Most recently created topics',
		description: 'A list of topics that have been created recently',
		feed_url: '/topics.rss',
		useMainPost: true,
	}, 'topics:tid', res);
}

async function generateForRecent(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}
	let token = null;
	if (req.query.token && req.query.uid) {
		token = await db.getObjectField(`user:${req.query.uid}`, 'rss_token');
	}

	await sendTopicsFeed({
		uid: token && token === req.query.token ? req.query.uid : req.uid,
		title: 'Recently Active Topics',
		description: 'A list of topics that have been active within the past 24 hours',
		feed_url: '/recent.rss',
		site_url: '/recent',
	}, 'topics:recent', res);
}

async function generateForTop(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}
	const term = terms[req.params.term] || 'day';

	let token = null;
	if (req.query.token && req.query.uid) {
		token = await db.getObjectField(`user:${req.query.uid}`, 'rss_token');
	}

	const uid = token && token === req.query.token ? req.query.uid : req.uid;

	const result = await topics.getSortedTopics({
		uid: uid,
		start: 0,
		stop: 19,
		term: term,
		sort: 'votes',
	});

	const feed = await generateTopicsFeed({
		uid: uid,
		title: 'Top Voted Topics',
		description: 'A list of topics that have received the most votes',
		feed_url: `/top/${req.params.term || 'daily'}.rss`,
		site_url: `/top/${req.params.term || 'daily'}`,
	}, result.topics);

	sendFeed(feed, res);
}

async function generateForPopular(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}

	const term = terms[req.params.term] || 'day';

	let token = null;
	if (req.query.token && req.query.uid) {
		token = await db.getObjectField(`user:${req.query.uid}`, 'rss_token');
	}

	const uid = token && token === req.query.token ? req.query.uid : req.uid;

	const result = await topics.getSortedTopics({
		uid: uid,
		start: 0,
		stop: 19,
		term: term,
		sort: 'posts',
	});

	const feed = await generateTopicsFeed({
		uid: uid,
		title: 'Popular Topics',
		description: 'A list of topics that are sorted by post count',
		feed_url: `/popular/${req.params.term || 'daily'}.rss`,
		site_url: `/popular/${req.params.term || 'daily'}`,
	}, result.topics);
	sendFeed(feed, res);
}

async function sendTopicsFeed(options, set, res) {
	const start = options.hasOwnProperty('start') ? options.start : 0;
	const stop = options.hasOwnProperty('stop') ? options.stop : 19;
	const topicData = await topics.getTopicsFromSet(set, options.uid, start, stop);
	const feed = await generateTopicsFeed(options, topicData.topics);
	sendFeed(feed, res);
}

async function generateTopicsFeed(feedOptions, feedTopics) {
	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	feedTopics = feedTopics.filter(Boolean);

	const feed = new rss(feedOptions);

	if (feedTopics.length > 0) {
		feed.pubDate = new Date(feedTopics[0].lastposttime).toUTCString();
	}

	async function addFeedItem(topicData) {
		const feedItem = {
			title: utils.stripHTMLTags(topicData.title, utils.tags),
			url: `${nconf.get('url')}/topic/${topicData.slug}`,
			date: new Date(topicData.lastposttime).toUTCString(),
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

async function generateForRecentPosts(req, res) {
	if (meta.config['feeds:disableRSS']) {
		return controllers404.send404(req, res);
	}
	const postData = await posts.getRecentPosts(req.uid, 0, 19, 'month');
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
		return controllers404.send404(req, res);
	}
	const cid = req.params.category_id;

	const [userPrivileges, category, postData] = await Promise.all([
		privileges.categories.get(cid, req.uid),
		categories.getCategoryData(cid),
		categories.getRecentReplies(cid, req.uid || req.query.uid || 0, 20),
	]);

	if (!category) {
		return controllers404.send404(req, res);
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
		return controllers404.send404(req, res);
	}

	const userslug = req.params.userslug;
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
		return controllers404.send404(req, res);
	}
	const tag = validator.escape(String(req.params.tag));
	const page = parseInt(req.query.page, 10) || 1;
	const topicsPerPage = meta.config.topicsPerPage || 20;
	const start = Math.max(0, (page - 1) * topicsPerPage);
	const stop = start + topicsPerPage - 1;
	await sendTopicsFeed({
		uid: req.uid,
		title: `Topics tagged with ${tag}`,
		description: `A list of topics that have been tagged with ${tag}`,
		feed_url: `/tags/${tag}.rss`,
		site_url: `/tags/${tag}`,
		start: start,
		stop: stop,
	}, `tag:${tag}:topics`, res);
}

function sendFeed(feed, res) {
	const xml = feed.xml();
	res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
}
