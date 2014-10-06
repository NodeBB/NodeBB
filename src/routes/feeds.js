"use strict";

var async = require('async'),
	rss = require('rss'),
	nconf = require('nconf'),

	posts = require('../posts'),
	topics = require('../topics'),
	categories = require('../categories'),
	meta = require('../meta'),
	privileges = require('../privileges');

function hasTopicPrivileges(req, res, next) {
	var tid = req.params.topic_id;

	hasPrivileges(privileges.topics.can, tid, req, res, next);
}

function hasCategoryPrivileges(req, res, next) {
	var cid = req.params.category_id;

	hasPrivileges(privileges.categories.can, cid, req, res, next);
}

function hasPrivileges(method, id, req, res, next) {
	var uid = req.user ? req.user.uid || 0 : 0;

	method('read', id, uid, function(err, canRead) {
		if (err) {
			return next(err);
		}

		if (!canRead) {
			return res.redirect(nconf.get('relative_path') + '/403');
		}

		return next();
	});
}

function generateForTopic(req, res, next) {
	var tid = req.params.topic_id;
	var uid = req.user ? req.user.uid : 0;

	privileges.topics.get(tid, uid, function(err, userPrivileges) {
		if (err) {
			return next(err);
		}

		topics.getTopicWithPosts(tid, 'tid:' + tid + ':posts', uid, 0, 25, false, function (err, topicData) {
			if (err) {
				return next(err);
			}

			if (topicData.deleted && !userPrivileges.view_deleted) {
				return res.redirect(nconf.get('relative_path') + '/404');
			}

			var description = topicData.posts.length ? topicData.posts[0].content : '';
			var image_url = topicData.posts.length ? topicData.posts[0].picture : '';
			var author = topicData.posts.length ? topicData.posts[0].username : '';

			var feed = new rss({
					title: topicData.title,
					description: description,
					feed_url: nconf.get('url') + '/topic/' + tid + '.rss',
					site_url: nconf.get('url') + '/topic/' + topicData.slug,
					image_url: image_url,
					author: author,
					ttl: 60
				}),
				dateStamp;

			if (topicData.posts.length > 0) {
				feed.pubDate = new Date(parseInt(topicData.posts[0].timestamp, 10)).toUTCString();
			}

			topicData.posts.forEach(function(postData) {
				if (!postData.deleted) {
					dateStamp = new Date(parseInt(parseInt(postData.edited, 10) === 0 ? postData.timestamp : postData.edited, 10)).toUTCString();

					feed.item({
						title: 'Reply to ' + topicData.title + ' on ' + dateStamp,
						description: postData.content,
						url: nconf.get('url') + '/topic/' + topicData.slug + '#' + postData.pid,
						author: postData.username,
						date: dateStamp
					});
				}
			});

			sendFeed(feed, res);
		});
	});
}

function generateForCategory(req, res, next) {
	var cid = req.params.category_id;
	var uid = req.user ? req.user.uid : 0;
	categories.getCategoryById(cid, 0, 25, uid, function (err, categoryData) {
		if (err) {
			return next(err);
		}

		var feed = generateTopicsFeed({
			title: categoryData.name,
			description: categoryData.description,
			feed_url: '/category/' + cid + '.rss',
			site_url: '/category/' + categoryData.cid,
		}, categoryData.topics);

		sendFeed(feed, res);
	});
}

function generateForRecent(req, res, next) {
	generateForTopics({
		title: 'Recently Active Topics',
		description: 'A list of topics that have been active within the past 24 hours',
		feed_url: '/recent.rss',
		site_url: '/recent'
	}, 'topics:recent', req, res, next);
}

function generateForPopular(req, res, next) {
	generateForTopics({
		title: 'Popular Topics',
		description: 'A list of topics that are sorted by post count',
		feed_url: '/popular.rss',
		site_url: '/popular'
	}, 'topics:posts', req, res, next);
}

function disabledRSS(req, res, next) {
	if (meta.config['feeds:disableRSS'] === '1') {
		return res.redirect(nconf.get('relative_path') + '/404');
	}

	next();
}

function generateForTopics(options, set, req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	topics.getTopicsFromSet(uid, set, 0, 19, function (err, data) {
		if (err) {
			return next(err);
		}

		var feed = generateTopicsFeed(options, data.topics);

		sendFeed(feed, res);
	});
}

function generateTopicsFeed(feedOptions, topics) {

	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	var	feed = new rss(feedOptions);

	if (topics.length > 0) {
		feed.pubDate = new Date(parseInt(topics[0].lastposttime, 10)).toUTCString();
	}

	topics.forEach(function(topicData) {
		feed.item({
			title: topicData.title,
			url: nconf.get('url') + '/topic/' + topicData.slug,
			author: topicData.username,
			date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
		});
	});

	return feed;
}

function generateForRecentPosts(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	posts.getRecentPosts(uid, 0, 19, 'month', function(err, posts) {
		if (err) {
			return next(err);
		}

		var feed = generateForPostsFeed({
			title: 'Recent Posts',
			description: 'A list of recent posts',
			feed_url: '/recentposts.rss',
			site_url: '/recentposts'
		}, posts);

		sendFeed(feed, res);
	});
}

function generateForCategoryRecentPosts(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	var cid = req.params.category_id;

	async.parallel({
		category: function(next) {
			categories.getCategoryData(cid, next);
		},
		posts: function(next) {
			categories.getRecentReplies(cid, uid, 20, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		var category = results.category;
		var posts = results.posts;

		var feed = generateForPostsFeed({
			title: category.name + ' Recent Posts',
			description: 'A list of recent posts from ' + category.name,
			feed_url: '/category/' + cid + '/recentposts.rss',
			site_url: '/category/' + cid + '/recentposts'
		}, posts);

		sendFeed(feed, res);
	});
}

function generateForPostsFeed(feedOptions, posts) {
	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	var	feed = new rss(feedOptions);

	if (posts.length > 0) {
		feed.pubDate = new Date(parseInt(posts[0].timestamp, 10)).toUTCString();
	}

	posts.forEach(function(postData) {
		feed.item({
			title: postData.topic ? postData.topic.title : '',
			description: postData.content,
			url: nconf.get('url') + '/topic/' + (postData.topic ? postData.topic.slug : '#') + '/'+postData.index,
			author: postData.user ? postData.user.username : '',
			date: new Date(parseInt(postData.timestamp, 10)).toUTCString()
		});
	});

	return feed;
}

function sendFeed(feed, res) {
	var xml = feed.xml();
	res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
}

module.exports = function(app, middleware, controllers){
	app.get('/topic/:topic_id.rss', hasTopicPrivileges, disabledRSS, generateForTopic);
	app.get('/category/:category_id.rss', hasCategoryPrivileges, disabledRSS, generateForCategory);
	app.get('/recent.rss', disabledRSS, generateForRecent);
	app.get('/popular.rss', disabledRSS, generateForPopular);
	app.get('/recentposts.rss', disabledRSS, generateForRecentPosts);
	app.get('/category/:category_id/recentposts.rss', hasCategoryPrivileges, disabledRSS, generateForCategoryRecentPosts);
};
