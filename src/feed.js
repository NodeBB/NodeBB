(function(Feed) {
	var	RDB = require('./redis.js'),
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

	Feed.saveFeed = function(location, feed) {
		var	savePath = path.join(__dirname, '../', location);

		fs.writeFile(savePath, feed.xml(), function (err) {
			if(err) {
				winston.err(err);
			}
		});
	}

	Feed.updateTopic = function(tid, cid) {
		if (process.env.NODE_ENV === 'development') winston.info('[rss] Updating RSS feeds for topic ' + tid);

		topics.getTopicWithPosts(tid, 0, 0, -1, function(err, topicData) {
			if (err) return winston.error('Problem saving topic RSS feed', err.stack);

			var	feed = new rss({
					title: topicData.topic_name,
					description: topicData.main_posts[0].content,
					feed_url: Feed.defaults.baseUrl + '/topics/' + tid + '.rss',
					site_url: nconf.get('url') + 'topic/' + topicData.slug,
					image_url: topicData.main_posts[0].picture,
					author: topicData.main_posts[0].username,
					pubDate: new Date(parseInt(topicData.main_posts[0].timestamp, 10)).toUTCString(),
					ttl: Feed.defaults.ttl
				}),
				topic_posts = topicData.main_posts.concat(topicData.posts),
				title, postData;

			for (var i = 0, ii = topic_posts.length; i < ii; i++) {
				title = 'Reply to ' + topicData.topic_name + ' on ' + (new Date(parseInt(topic_posts[i].timestamp, 10)).toUTCString());
				postData = topic_posts[i];

				feed.item({
					title: title,
					description: postData.content,
					url: nconf.get('url') + 'topic/' + topicData.slug + '#' + postData.pid,
					author: postData.username,
					date: new Date(parseInt(postData.edited === 0 ? postData.timestamp : postData.edited, 10)).toUTCString()
				});
			}

			Feed.saveFeed('feeds/topics/' + tid + '.rss', feed);
		});

	};

	Feed.updateCategory = function(cid) {
		if (process.env.NODE_ENV === 'development') winston.info('[rss] Updating RSS feeds for category ' + cid);
		categories.getCategoryById(cid, 0, function(err, categoryData) {
			if (err) return winston.error('Could not update RSS feed for category ' + cid, err.stack);

			var	feed = new rss({
					title: categoryData.category_name,
					description: categoryData.category_description,
					feed_url: Feed.defaults.baseUrl + '/categories/' + cid + '.rss',
					site_url: nconf.get('url') + 'category/' + categoryData.category_id,
					pubDate: new Date(parseInt(categoryData.topics[0].lastposttime, 10)).toUTCString(),
					ttl: Feed.defaults.ttl
				}),
				topics = categoryData.topics,
				title, topicData;

			for (var i = 0, ii = topics.length; i < ii; i++) {
				title = topics[i].title + '. Posted on ' + (new Date(parseInt(topics[i].timestamp, 10)).toUTCString());
				topicData = topics[i];

				feed.item({
					title: title,
					url: nconf.get('url') + 'topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
			}

			Feed.saveFeed('feeds/categories/' + cid + '.rss', feed);
		});

	};
}(exports));