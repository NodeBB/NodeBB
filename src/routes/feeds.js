(function (Feeds) {
	var posts = require('../posts'),
		topics = require('../topics'),
		categories = require('../categories'),

		rss = require('rss'),
		nconf = require('nconf'),

		ThreadTools = require('../threadTools'),
		CategoryTools = require('../categoryTools');

	Feeds.createRoutes = function(app){
		app.get('/topic/:topic_id.rss', hasTopicPrivileges, generateForTopic);
		app.get('/category/:category_id.rss', hasCategoryPrivileges, generateForCategory);
		app.get('/recent.rss', generateForRecent);
		app.get('/popular.rss', generateForPopular);
	};


	function hasTopicPrivileges(req, res, next) {
		var tid = req.params.topic_id;
		var uid = req.user ? req.user.uid || 0 : 0;

		ThreadTools.privileges(tid, uid, function(err, privileges) {
			if(err) {
				return next(err);
			}

			if(!privileges.read) {
				return res.redirect('403');
			}

			return next();
		});
	}

	function hasCategoryPrivileges(req, res, next) {
		var cid = req.params.category_id;
		var uid = req.user ? req.user.uid || 0 : 0;

		CategoryTools.privileges(cid, uid, function(err, privileges) {
			if(err) {
				return next(err);
			}

			if(!privileges.read) {
				return res.redirect('403');
			}

			return next();
		});
	}


	function generateForTopic(req, res, next) {
		var tid = req.params.topic_id;

		topics.getTopicWithPosts(tid, 0, 0, 25, function (err, topicData) {
			if (err) {
				return next(err);
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

			// Add pubDate if topic contains posts
			if (topicData.posts.length > 0) {
				feed.pubDate = new Date(parseInt(topicData.posts[0].timestamp, 10)).toUTCString();
			}

			topicData.posts.forEach(function(postData) {
				if (parseInt(postData.deleted, 10) === 0) {
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

			var xml = feed.xml();
			res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
		});

	};

	function generateForCategory(req, res, next) {
		var cid = req.params.category_id;

		categories.getCategoryById(cid, 0, 25, 0, function (err, categoryData) {
			if (err) {
				return next(err);
			}

			var feed = new rss({
					title: categoryData.name,
					description: categoryData.description,
					feed_url: nconf.get('url') + '/category/' + cid + '.rss',
					site_url: nconf.get('url') + '/category/' + categoryData.cid,
					ttl: 60
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

			var xml = feed.xml();
			res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
		});
	};

	function generateForRecent(req, res, next) {
		topics.getLatestTopics(0, 0, 19, 'month', function (err, recentData) {
			if(err){
				return next(err);
			}

			var	feed = new rss({
					title: 'Recently Active Topics',
					description: 'A list of topics that have been active within the past 24 hours',
					feed_url: nconf.get('url') + '/recent.rss',
					site_url: nconf.get('url') + '/recent',
					ttl: 60
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

			var xml = feed.xml();
			res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
		});
	};

	function generateForPopular(req, res, next) {
		topics.getTopicsFromSet(0, 'topics:posts', 0, 19, function (err, popularData) {
			if(err){
				return next(err);
			}

			var	feed = new rss({
					title: 'Popular Topics',
					description: 'A list of topics that are sorted by post count',
					feed_url: nconf.get('url') + '/popular.rss',
					site_url: nconf.get('url') + '/popular',
					ttl: 60
				});

			// Add pubDate if recent topics list contains topics
			if (popularData.topics.length > 0) {
				feed.pubDate = new Date(parseInt(popularData.topics[0].lastposttime, 10)).toUTCString();
			}

			popularData.topics.forEach(function(topicData) {
				feed.item({
					title: topicData.title,
					url: nconf.get('url') + '/topic/' + topicData.slug,
					author: topicData.username,
					date: new Date(parseInt(topicData.lastposttime, 10)).toUTCString()
				});
			});

			var xml = feed.xml();
			res.type('xml').set('Content-Length', Buffer.byteLength(xml)).send(xml);
		});
	};
}(exports));
