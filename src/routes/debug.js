var	DebugRoute = function(app) {
		app.namespace('/debug', function() {
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