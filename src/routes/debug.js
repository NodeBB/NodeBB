var	DebugRoute = function(app) {
		app.namespace('/debug', function() {
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
				topics.getTopicData(req.params.tid, function (data) {
					if (data) {
						res.send(data);
					} else {
						res.send(404, "Topic doesn't exist!");
					}
				});
			});

			app.get('/pid/:pid', function (req, res) {
				posts.getPostData(req.params.pid, function (data) {
					if (data) {
						res.send(data);
					} else {
						res.send(404, "Post doesn't exist!");
					}
				});
			});

			app.get('/prune', function(req, res) {
				var	Notifications = require('../notifications');

				Notifications.prune(new Date(), function() {
					console.log('done');
				});
				res.send();
			});

			app.get('/uuidtest', function(req, res) {
				var	Utils = require('../../public/src/utils.js');

				res.send(Utils.generateUUID());
			});
		});
	};

module.exports = DebugRoute;