(function(Feed) {
	var	RDB = require('./redis.js'),
		schema = require('./schema.js'),
		posts = require('./posts.js'),
		topics = require('./topics.js'),
		fs = require('fs'),
		rss = require('node-rss');

	function saveFeed(location, feed) {
		fs.writeFile(location, rss.getFeedXML(feed), function (err) {
			if (err) throw err;
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

		function getTopicData(next) {
			topics.getTopicById(tid, 0, function(topicData) {
				next(null, topicData);
			});
		}

		function getPostsData(next) {
			posts.getPostsByTid(tid, -20, -1, function(postsData) {
				next(null, postsData);
			});
		}


		async.parallel([getTopicData, getPostsData], function(err, results) {
			var topicData = results[0],
				postsData = results[1].postData,
				userData = results[1].userData,
				location = '/topic/' + topicData.slug,
				xml_url = '/topic/' + tid + '.rss';

			var post = topicData.main_posts[0];
			var urn = 'urn:' + cid + ':' + tid;

			var feed = createFeed(topicData.topic_name, '', location, xml_url, post.username, urn);
			var title;

			for (var i = 0, ii = postsData.pid.length; i < ii; i++) {
				urn = 'urn:' + cid + ':' + tid + ':' + postsData.pid[i];
				title = 'Reply to ' + topicData.topic_name + ' on ' + (new Date(parseInt(postsData.timestamp[i], 10)).toUTCString());

				feed.addNewItem(
					title,
					location,
					postsData.timestamp[i],
					postsData.content[i],
					{
						'urn' : urn,
						'username' : userData[postsData.uid[i]].username
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