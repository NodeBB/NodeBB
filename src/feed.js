(function(Feed) {
	var	RDB = require('./redis.js'),
		schema = require('./schema.js'),
		posts = require('./posts.js'),
		topics = require('./topics.js'),
		fs = require('fs');

	function saveFeed(feed, xml, tid) {
		feed.endEntry();

		fs.writeFile('feeds/topics/' + tid + '.rss', xml.toString(), function (err) {
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
		var cache_time_in_seconds = 60,
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

			saveFeed(feed, xml, tid);
		});

	};

	Feed.updateCategory = function(params) {

	};
}(exports));