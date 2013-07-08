(function(Feed) {
	var	RDB = require('./redis.js'),
		schema = require('./schema.js'),
		posts = require('./posts.js'),
		topics = require('./topics.js'),
		fs = require('fs'),
		rss = require('node-rss');

	function saveFeed(location, feed) {
		fs.writeFile(location, rss.getFeedXML(feed), function (err) {
			if(err) {
				console.log(err);
			}
		});
	}

	function createFeed(title, description, feed_url, xml_url, author, urn) {
		return rss.createNewFeed(
			title,
			feed_url,
			description,
			author,
			xml_url, 
			{
				'urn' : urn
			}
		);	
	}


	Feed.updateTopic = function(tid, cid) {
		var cache_time_in_seconds = 60;

		topics.getTopicWithPosts(tid, 0, function(err, topicData) {
			if (err) console.log('Error: Problem saving topic RSS feed', err);

			var location = '/topic/' + topicData.slug,
				xml_url = '/topic/' + tid + '.rss';

			var post = topicData.main_posts[0];
			var urn = 'urn:' + cid + ':' + tid;

			var feed = createFeed(topicData.topic_name, '', location, xml_url, post.username, urn);
			var title;

			var topic_posts = topicData.main_posts.concat(topicData.posts);

			for (var i = 0, ii = topic_posts.length; i < ii; i++) {
				urn = 'urn:' + cid + ':' + tid + ':' + topic_posts[i].pid;
				title = 'Reply to ' + topicData.topic_name + ' on ' + (new Date(parseInt(topic_posts[i].timestamp, 10)).toUTCString());

				feed.addNewItem(
					title,
					location,
					topic_posts[i].timestamp,
					topic_posts[i].content,
					{
						'urn' : urn,
						'username' : topic_posts[i].username
					}
				);
			}

			saveFeed('feeds/topics/' + tid + '.rss', feed);
		});

	};

	Feed.updateCategory = function(cid) {
		categories.getCategoryById(cid, 0, function(categoryData) {
			var location = '/category/' + categoryData.category_id + '/' + categoryData.category_name,
				xml_url = '/category' + cid + '.rss';

			var urn = 'urn:' + cid;
			var feed = createFeed(categoryData.category_name, '', location, xml_url, 'NodeBB', urn); // not exactly sure if author for a category should be site_title?
			
			var title;
			var topics = categoryData.topics;

			for (var i = 0, ii = topics.length; i < ii; i++) {
				urn = 'urn:' + cid + ':' + topics[i].tid;
				title = topics[i].title + '. Posted on ' + (new Date(parseInt(topics[i].timestamp, 10)).toUTCString());
				
				feed.addNewItem(
					title,
					location,
					topics[i].timestamp,
					topics[i].teaser_text,
					{
						'urn' : urn,
						'username' : topics[i].username
					}
				);
			}

			saveFeed('feeds/categories/' + cid + '.rss', feed);
		});

	};
}(exports));