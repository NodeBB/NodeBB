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
		ttl: 60,
		basePath: path.join(__dirname, '../', 'feeds'),
		baseUrl: nconf.get('url') + '/feeds'
	};

	Feed.saveFeed = function (location, feed, callback) {
		var savePath = path.join(__dirname, '../', location);

		fs.writeFile(savePath, feed.xml(), function (err) {
			if (err) return winston.err(err);

			if (callback) callback(err);
		});
	}

	Feed.updateTopic = function (tid, callback) {
		topics.getTopicWithPosts(tid, 0, 0, -1, true, function (err, topicData) {
			if (err) {
				if(callback) {
					return callback(new Error('topic-invalid'));
				} else {
					winston.error(err.message);
					return;
				}
			}

			var description = topicData.posts.length ? topicData.posts[0].content : '';
			var image_url = topicData.posts.length ? topicData.posts[0].picture : '';
			var author = topicData.posts.length ? topicData.posts[0].username : '';

			var feed = new rss({
					title: topicData.topic_name,
					description: description,
					feed_url: Feed.defaults.baseUrl + '/topics/' + tid + '.rss',
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

			async.each(topicData.posts, function(postData, next) {
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

				next();
			}, function() {
				Feed.saveFeed('feeds/topics/' + tid + '.rss', feed, function (err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('[rss] Re-generated RSS Feed for tid ' + tid + '.');
					}

					if (callback) {
						callback();
					}
				});
			});
		});

	};

	Feed.updateCategory = function (cid, callback) {
		categories.getCategoryById(cid, 0, 25, 0, function (err, categoryData) {
			if (err) return callback(new Error('category-invalid'));

			var feed = new rss({
					title: categoryData.category_name,
					description: categoryData.category_description,
					feed_url: Feed.defaults.baseUrl + '/categories/' + cid + '.rss',
					site_url: nconf.get('url') + '/category/' + categoryData.category_id,
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if category has topics
			if (categoryData.topics.length > 0) feed.pubDate = new Date(parseInt(categoryData.topics[0].lastposttime, 10)).toUTCString();

			async.eachSeries(categoryData.topics, function(topicData, next) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});

				next();
			}, function() {
				Feed.saveFeed('feeds/categories/' + cid + '.rss', feed, function (err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('[rss] Re-generated RSS Feed for cid ' + cid + '.');
					}

					if (callback) {
						callback();
					}
				});
			});
		});
	};

	Feed.updateRecent = function(callback) {
		topics.getLatestTopics(0, 0, 19, undefined, function (err, recentData) {
			var	feed = new rss({
					title: 'Recently Active Topics',
					description: 'A list of topics that have been active within the past 24 hours',
					feed_url: Feed.defaults.baseUrl + '/recent.rss',
					site_url: nconf.get('url') + '/recent',
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if recent topics list contains topics
			if (recentData.topics.length > 0) {
				feed.pubDate = new Date(parseInt(recentData.topics[0].lastposttime, 10)).toUTCString();
			}

			async.eachSeries(recentData.topics, function(topicData, next) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
				next();
			}, function() {
				Feed.saveFeed('feeds/recent.rss', feed, function (err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('[rss] Re-generated "recent posts" RSS Feed.');
					}

					if (callback) callback();
				});
			});
		});
	};

	Feed.updatePopular = function(callback) {
		topics.getTopicsFromSet(0, 'topics:posts', 0, 19, function (err, popularData) {
			var	feed = new rss({
					title: 'Popular Topics',
					description: 'A list of topics that are sorted by post count',
					feed_url: Feed.defaults.baseUrl + '/popular.rss',
					site_url: nconf.get('url') + '/popular',
					ttl: Feed.defaults.ttl
				});

			// Add pubDate if recent topics list contains topics
			if (popularData.topics.length > 0) {
				feed.pubDate = new Date(parseInt(popularData.topics[0].lastposttime, 10)).toUTCString();
			}

			async.eachSeries(popularData.topics, function(topicData, next) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
				next();
			}, function() {
				Feed.saveFeed('feeds/popular.rss', feed, function (err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('[rss] Re-generated "popular posts" RSS Feed.');
					}

					if (callback) callback();
				});
			});
		});
	};

	Feed.loadFeed = function(rssPath, res) {
		fs.readFile(rssPath, function (err, data) {
			if (err) {
				res.type('text').send(404, "Unable to locate an rss feed at this location.");
			} else {
				res.type('xml').set('Content-Length', data.length).send(data);
			}
		});
	};
}(exports));