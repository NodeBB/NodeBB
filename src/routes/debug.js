var	DebugRoute = function(app) {
		var	Notifications = require('../notifications');

		app.namespace('/debug', function() {
			app.get('/prune', function(req, res) {
				Notifications.prune(new Date(), function() {
					console.log('done');
				});
				res.send();
			});
		});
	};

module.exports = DebugRoute;