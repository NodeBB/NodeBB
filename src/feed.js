(function(Feed) {
	var RDB = require('./redis.js'),
		schema = require('./schema.js'),
		posts = require('./posts.js'),
		topics = require('./topics.js'),
		fs = require('fs'),
		rss = require('rss'),
		winston = require('winston'),
		path = require('path');

	Feed.defaults = {
		ttl: 60,
		basePath: path.join(__dirname, '../', 'feeds'),
		baseUrl: nconf.get('url') + 'feeds'
	};

	Feed.saveFeed = function(location, feed, callback) {
		var savePath = path.join(__dirname, '../', location);

		fs.writeFile(savePath, feed.xml(), function(err) {
			if (err) return winston.err(err);

			if (callback) callback(err);
		});
	}

	Feed.updateTopic = function(tid, callback) {
		if (process.env.NODE_ENV === 'development') winston.info('[rss] Updating RSS feeds for topic ' + tid);

		topics.getTopicWithPosts(tid, 0, 0, -1, function(err, topicData) {
			if (err) return callback(new Error('topic-invalid'));

			var feed = new rss({
				title: topicData.topic_name,
				description: topicData.main_posts[0].content,
				feed_url: Feed.defaults.baseUrl + '/topics/' + tid + '.rss',
				site_url: nconf.get('url') + 'topic/' + topicData.slug,
				image_url: topicData.main_posts[0].picture,
				author: topicData.main_posts[0].username,
				ttl: Feed.defaults.ttl
			}),
				topic_posts = topicData.main_posts.concat(topicData.posts),
				title, postData, dateStamp;

			// Add pubDate if topic contains posts
			if (topicData.main_posts.length > 0) feed.pubDate = new Date(parseInt(topicData.main_posts[0].timestamp, 10)).toUTCString();

			for (var i = 0, ii = topic_posts.length; i < ii; i++) {
				if (topic_posts[i].deleted === '0') {
					postData = topic_posts[i];
					dateStamp = new Date(parseInt(postData.edited === '0' ? postData.timestamp : postData.edited, 10)).toUTCString();
					title = 'Reply to ' + topicData.topic_name + ' on ' + dateStamp;

					feed.item({
						title: title,
						description: postData.content,
						url: nconf.get('url') + 'topic/' + topicData.slug + '#' + postData.pid,
						author: postData.username,
						date: dateStamp
					});
				}
			}

			Feed.saveFeed('feeds/topics/' + tid + '.rss', feed, function(err) {
				if (callback) callback();
			});
		});

	};

	Feed.updateCategory = function(cid, callback) {
		if (process.env.NODE_ENV === 'development') winston.info('[rss] Updating RSS feeds for category ' + cid);
		categories.getCategoryById(cid, 0, function(err, categoryData) {
			if (err) return callback(new Error('category-invalid'));

			var feed = new rss({
				title: categoryData.category_name,
				description: categoryData.category_description,
				feed_url: Feed.defaults.baseUrl + '/categories/' + cid + '.rss',
				site_url: nconf.get('url') + 'category/' + categoryData.category_id,
				ttl: Feed.defaults.ttl
			}),
				topics = categoryData.topics,
				title, topicData, dateStamp;

			// Add pubDate if category has topics
			if (categoryData.topics.length > 0) feed.pubDate = new Date(parseInt(categoryData.topics[0].lastposttime, 10)).toUTCString();

			for (var i = 0, ii = topics.length; i < ii; i++) {
				topicData = topics[i];
				dateStamp = new Date(parseInt(topicData.lastposttime, 10)).toUTCString();
				title = topics[i].title;

				feed.item({
					title: title,
					url: nconf.get('url') + 'topic/' + topicData.slug,
					author: topicData.username,
					date: dateStamp
				});
			}

			Feed.saveFeed('feeds/categories/' + cid + '.rss', feed, function(err) {
				if (callback) callback();
			});
		});

	};
}(exports));