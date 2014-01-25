
var user = require('./../user'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	posts = require('./../posts');

var	DebugRoute = function(app) {

	app.namespace('/debug', function() {

		app.get('/uid/:uid', function (req, res) {

			if (!req.params.uid)
				return res.redirect('/404');

			user.getUserData(req.params.uid, function (err, data) {
				if (data) {
					res.send(data);
				} else {
					res.json(404, {
						error: "User doesn't exist!"
					});
				}
			});
		});


		app.get('/cid/:cid', function (req, res) {
			categories.getCategoryData(req.params.cid, function (err, data) {
				if (data) {
					res.send(data);
				} else {
					res.send(404, "Category doesn't exist!");
				}
			});
		});

		app.get('/tid/:tid', function (req, res) {
			topics.getTopicData(req.params.tid, function (err, data) {
				if (data) {
					res.send(data);
				} else {
					res.send(404, "Topic doesn't exist!");
				}
			});
		});

		app.get('/pid/:pid', function (req, res) {
			posts.getPostData(req.params.pid, function (err, data) {
				if (data) {
					res.send(data);
				} else {
					res.send(404, "Post doesn't exist!");
				}
			});
		});

		app.get('/groups/prune', function(req, res) {
			var	Groups = require('../groups');

			Groups.prune(function(err) {
				res.send('pruned');
			});
		});

		app.get('/reindex', function (req, res) {
			topics.reIndexAll(function (err) {
				if (err) {
					return res.json(err);
				} else {
					res.send('Topics and users reindexed');
				}
			});
		});

		app.get('/test', function(req, res) {

			/*topics.getTopicPosts2(2, 0, 10, 5, function(err, data) {
				res.json(data);
			})*/
			topics.getTopicWithPosts(2, 1, 0, -1, true, function (err, topicData) {
				res.json(topicData);
			});
		});

	});
};

module.exports = DebugRoute;