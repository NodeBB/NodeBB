(function (Feed) {
	var db = require('./database'),
		posts = require('./posts'),
		topics = require('./topics'),
		categories = require('./categories'),

		fs = require('fs'),
		rss = require('rss'),
		winston = require('winston'),
		path = require('path'),
		nconf = require('nconf'),
		async = require('async');

	Feed.defaults = {
		ttl: 60
	};

	Feed.forTopic = function (tid, callback) {
		topics.getTopicWithPosts(tid, 0, 0, -1, true, function (err, topicData) {
			if (err) {
				return callback(new Error('topic-invalid'));
			}

			var description = topicData.posts.length ? topicData.posts[0].content : '';
			var image_url = topicData.posts.length ? topicData.posts[0].picture : '';
			var author = topicData.posts.length ? topicData.posts[0].username : '';

			var feed = new rss({
					title: topicData.topic_name,
					description: description,
					feed_url: nconf.get('url') + '/topic/' + tid + '.rss',
					site_url: nconf.get('url') + '/topic/' + topicData.slug,
					image_url: image_url,
					author: author,
					ttl: Feed.defaults.ttl
				}),
				dateStamp;

			// Add pubDate if topic contains posts
			if (topicData.posts.length > 0) {
				feed.pubDate = new Date(parseInt(topicData.posts[0].timestamp, 10)).toUTCString();
			}

			topicData.posts.forEach(function(postData) {
				if (parseInt(postData.deleted, 10) === 0) {
					dateStamp = new Date(parseInt(parseInt(postData.edited, 10) === 0 ? postData.timestamp : postData.edited, 10)).toUTCString();

					feed.item({
						title: 'Reply to ' + topicData.topic_name + ' on ' + dateStamp,
						description: postData.content,
						url: nconf.get('url') + '/topic/' + topicData.slug + '#' + postData.pid,
						author: postData.username,
						date: dateStamp
					});
				}
			});

			callback(null, feed.xml());
		});

	};

	Feed.forCategory = function (cid, callback) {
		categories.getCategoryById(cid, 0, 25, 0, function (err, categoryData) {
			if (err) {
				return callback(new Error('category-invalid'));
			}

			var feed = new rss({
					title: categoryData.category_name,
					description: categoryData.category_description,
					feed_url: nconf.get('url') + '/category/' + cid + '.rss',
					site_url: nconf.get('url') + '/category/' + categoryData.category_id,
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if category has topics
			if (categoryData.topics.length > 0) feed.pubDate = new Date(parseInt(categoryData.topics[0].lastposttime, 10)).toUTCString();

			categoryData.topics.forEach(function(topicData) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
			});

			callback(null, feed.xml());
		});
	};

	Feed.forRecent = function(callback) {
		topics.getLatestTopics(0, 0, 19, undefined, function (err, recentData) {
			if(err){
				return callback(err);
			}

			var	feed = new rss({
					title: 'Recently Active Topics',
					description: 'A list of topics that have been active within the past 24 hours',
					feed_url: nconf.get('url') + '/recent.rss',
					site_url: nconf.get('url') + '/recent',
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if recent topics list contains topics
			if (recentData.topics.length > 0) {
				feed.pubDate = new Date(parseInt(recentData.topics[0].lastposttime, 10)).toUTCString();
			}

			recentData.topics.forEach(function(topicData) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
			});

			callback(null, feed.xml());
		});
	};

	Feed.forPopular = function(callback) {
		topics.getTopicsFromSet(0, 'topics:posts', 0, 19, function (err, popularData) {
			if(err){
				return callback(err);
			}

			var	feed = new rss({
					title: 'Popular Topics',
					description: 'A list of topics that are sorted by post count',
					feed_url: nconf.get('url') + '/popular.rss',
					site_url: nconf.get('url') + '/popular',
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if recent topics list contains topics
			if (popularData.topics.length > 0) {
				feed.pubDate = new Date(parseInt(popularData.topics[0].lastposttime, 10)).toUTCString();
			}

			popularData.topics.forEach(function(topicData, next) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
			});

			callback(null, feed.xml());
		});
	};
}(exports));
