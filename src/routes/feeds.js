"use strict";

var async = require('async');
var rss = require('rss');
var nconf = require('nconf');

var posts = require('../posts');
var topics = require('../topics');
var user = require('../user');
var categories = require('../categories');
var meta = require('../meta');
var helpers = require('../controllers/helpers');
var privileges = require('../privileges');


function generateForTopic(req, res, callback) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return callback();
	}

	var tid = req.params.topic_id;
	var userPrivileges;
	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function(next) {
					privileges.topics.get(tid, req.uid, next);
				},
				topic: function(next) {
					topics.getTopicData(tid, next);
				}
			}, next);
		},
		function (results, next) {
			if (!results.topic) {
				return callback();
			}
			if (parseInt(results.topic.deleted, 10) && !results.privileges.view_deleted) {
				return callback();
			}
			if (!results.privileges.read) {
				return helpers.notAllowed(req, res);
			}
			userPrivileges = results.privileges;
			topics.getTopicWithPosts(results.topic, 'tid:' + tid + ':posts', req.uid, 0, 25, false, next);
		}
	], function(err, topicData) {
		if (err) {
			return callback(err);
		}

		topics.modifyPostsByPrivilege(topicData, userPrivileges);

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
					url: nconf.get('url') + '/topic/' + topicData.slug + (postData.index ? '/' + (postData.index + 1) : ''),
					author: postData.user ? postData.user.username : '',
					date: dateStamp
				});
			}
		});

		sendFeed(feed, res);
	});
}

function generateForUserTopics(req, res, callback) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return callback();
	}

	var userslug = req.params.userslug;

	async.waterfall([
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (uid, next) {
			if (!uid) {
				return callback();
			}
			user.getUserFields(uid, ['uid', 'username'], next);
		}
	], function(err, userData) {
		if (err) {
			return callback(err);
		}

		generateForTopics({
			uid: req.uid,
			title: 'Topics by ' + userData.username,
			description: 'A list of topics that are posted by ' + userData.username,
			feed_url: '/user/' + userslug + '/topics.rss',
			site_url: '/user/' + userslug + '/topics'
		}, 'uid:' + userData.uid + ':topics', req, res, callback);
	});
}

function generateForCategory(req, res, next) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return next();
	}
	var cid = req.params.category_id;

	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function(next) {
					privileges.categories.get(cid, req.uid, next);
				},
				category: function(next) {
					categories.getCategoryById({
						cid: cid,
						set: 'cid:' + cid + ':tids',
						reverse: true,
						start: 0,
						stop: 25,
						uid: req.uid
					}, next);
				}
			}, next);
		},
		function (results, next) {
			if (!results.privileges.read) {
				return helpers.notAllowed(req, res);
			}
			generateTopicsFeed({
				uid: req.uid,
				title: results.category.name,
				description: results.category.description,
				feed_url: '/category/' + cid + '.rss',
				site_url: '/category/' + results.category.cid,
			}, results.category.topics, next);
		}
	], function(err, feed) {
		if (err) {
			return next(err);
		}
		sendFeed(feed, res);
	});
}

function generateForRecent(req, res, next) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return next();
	}
	generateForTopics({
		uid: req.uid,
		title: 'Recently Active Topics',
		description: 'A list of topics that have been active within the past 24 hours',
		feed_url: '/recent.rss',
		site_url: '/recent'
	}, 'topics:recent', req, res, next);
}

function generateForPopular(req, res, next) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return next();
	}
	var terms = {
		daily: 'day',
		weekly: 'week',
		monthly: 'month',
		alltime: 'alltime'
	};
	var term = terms[req.params.term] || 'day';

	topics.getPopular(term, req.uid, 19, function(err, topics) {
		if (err) {
			return next(err);
		}

		generateTopicsFeed({
			uid: req.uid,
			title: 'Popular Topics',
			description: 'A list of topics that are sorted by post count',
			feed_url: '/popular/' + (req.params.term || 'daily') + '.rss',
			site_url: '/popular/' + (req.params.term || 'daily')
		}, topics, function(err, feed) {
			if (err) {
				return next(err);
			}
			sendFeed(feed, res);
		});
	});
}

function generateForTopics(options, set, req, res, next) {
	topics.getTopicsFromSet(set, req.uid, 0, 19, function (err, data) {
		if (err) {
			return next(err);
		}

		generateTopicsFeed(options, data.topics, function(err, feed) {
			if (err) {
				return next(err);
			}
			sendFeed(feed, res);
		});
	});
}

function generateTopicsFeed(feedOptions, feedTopics, callback) {

	feedOptions.ttl = 60;
	feedOptions.feed_url = nconf.get('url') + feedOptions.feed_url;
	feedOptions.site_url = nconf.get('url') + feedOptions.site_url;

	feedTopics = feedTopics.filter(Boolean);

	var	feed = new rss(feedOptions);

	if (feedTopics.length > 0) {
		feed.pubDate = new Date(parseInt(feedTopics[0].lastposttime, 10)).toUTCString();
	}

	async.map(feedTopics, function(topicData, next) {
		var feedItem = {
			title: topicData.title,
			url: nconf.get('url') + '/topic/' + topicData.slug,
			date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
		};

		if (topicData.teaser && topicData.teaser.user) {
			feedItem.description = topicData.teaser.content;
			feedItem.author = topicData.teaser.user.username;
			return next(null, feedItem);
		}

		topics.getMainPost(topicData.tid, feedOptions.uid, function(err, mainPost) {
			if (err) {
				return next(err);
			}
			if (!mainPost) {
				return next(null, feedItem);
			}
			feedItem.description = mainPost.content;
			feedItem.author = mainPost.user.username;
			next(null, feedItem);
		});
	}, function(err, feedItems) {
		if (err) {
			return callback(err);
		}
		feedItems.forEach(function(feedItem) {
			if (feedItem) {
				feed.item(feedItem);
			}
		});
		callback(null, feed);
	});
}

function generateForRecentPosts(req, res, next) {
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return next();
	}

	posts.getRecentPosts(req.uid, 0, 19, 'month', function(err, posts) {
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
	if (parseInt(meta.config['feeds:disableRSS'], 10) === 1) {
		return next();
	}
	var cid = req.params.category_id;

	async.parallel({
		privileges: function(next) {
			privileges.categories.get(cid, req.uid, next);
		},
		category: function(next) {
			categories.getCategoryData(cid, next);
		},
		posts: function(next) {
			categories.getRecentReplies(cid, req.uid, 20, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		if (!results.category) {
			return next();
		}

		if (!results.privileges.read) {
			return helpers.notAllowed(req, res);
		}

		var feed = generateForPostsFeed({
			title: results.category.name + ' Recent Posts',
			description: 'A list of recent posts from ' + results.category.name,
			feed_url: '/category/' + cid + '/recentposts.rss',
			site_url: '/category/' + cid + '/recentposts'
		}, results.posts);

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
	app.get('/topic/:topic_id.rss', generateForTopic);
	app.get('/category/:category_id.rss', generateForCategory);
	app.get('/recent.rss', generateForRecent);
	app.get('/popular.rss', generateForPopular);
	app.get('/popular/:term.rss', generateForPopular);
	app.get('/recentposts.rss', generateForRecentPosts);
	app.get('/category/:category_id/recentposts.rss', generateForCategoryRecentPosts);
	app.get('/user/:userslug/topics.rss', generateForUserTopics);
};
