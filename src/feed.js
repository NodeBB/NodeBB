(function(Feed) {
	var	RDB = require('./redis.js'),
		schema = require('./schema.js'),
		posts = require('./posts.js'),
		topics = require('./topics.js'),
		fs = require('fs');

	function saveFeed(location, feed, xml) {
		feed.endEntry();
		fs.writeFile(location, xml.toString(), function (err) {
			if (err) throw err;
		});
	}

	function createFeed(xml, urn, title, feed_url, author) {
		var ATOMWriter = require('atom-writer'),
			feed = new ATOMWriter(xml);

		return feed
				  .startFeed(urn)
				  .writeStartIndex(1)
				  .writeItemsPerPage(20)
				  .writeTotalResults(20)
				  .writeTitle(title)
				  .writeLink(feed_url, 'application/atom+xml', 'self');
	}

	function createEntry(feed, urn, title, content, url, author) {
		return feed		
				  .startEntry(urn)
				  .writeTitle(title)
				  .writeLink(url, 'text/html')
				  .writeContent(content, 'text', 'en')
				  .writeAuthorRAW(author)
				  .endEntry();
	}

	Feed.updateTopic = function(tid, cid) {
		return;
		var cache_time_in_seconds = 60, //todo. don't rewrite xml every time something is posted.
			XMLWriter = require('xml-writer');
			xml = new XMLWriter(true);

		function getTopicData(next) {
			topics.getTopicById(tid, 0, function(topicData) {
				next(null, topicData);
			});
		}

		function getPostsData(next) {
			posts.getPostsByTid(tid, 0, -20, -1, function(postsData) {
				next(null, postsData);
			});
		}


		async.parallel([getTopicData, getPostsData], function(err, results) {
			var topicData = results[0],
				postsData = results[1].postData,
				userData = results[1].userData,
				url = '/topic/' + topicData.slug;

			var post = topicData.main_posts[0];
			var urn = 'urn:' + cid + ':' + tid;
			var feed = createFeed(xml, urn, topicData.topic_name, url, post.username);
			var title;

			for (var i = 0, ii = postsData.pid.length; i < ii; i++) {
				urn = 'urn:' + cid + ':' + tid + ':' + postsData.pid[i];
				title = 'Reply to ' + topicData.topic_name + ' on ' + (new Date(parseInt(postsData.timestamp[i], 10)).toUTCString());
				feed = createEntry(feed, urn, title, postsData.content[i], url, userData[postsData.uid[i]].username);
			}

			saveFeed('feeds/topics/' + tid + '.rss', feed, xml);
		});

	};

	Feed.updateCategory = function(cid) {
		var XMLWriter = require('xml-writer');
			xml = new XMLWriter(true);

		categories.getCategoryById(cid, 0, function(categoryData) {
			var url = '/category/' + categoryData.category_id + '/' + categoryData.category_name;

			var urn = 'urn:' + cid;
			var feed = createFeed(xml, urn, categoryData.category_name, url, 'NodeBB'); // not exactly sure if author for a category should be site_title?
			var title;
			var topics = categoryData.topics;

			for (var i = 0, ii = topics.length; i < ii; i++) {
				urn = 'urn:' + cid + ':' + topics[i].tid;
				title = topics[i].title + '. Posted on ' + (new Date(parseInt(topics[i].timestamp, 10)).toUTCString());
				feed = createEntry(feed, urn, title, topics[i].teaser_text, url, topics[i].username);
			}

			saveFeed('feeds/categories/' + cid + '.rss', feed, xml);
		});

	};
}(exports));