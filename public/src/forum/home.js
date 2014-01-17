define(function() {
	var	home = {};

	home.init = function() {

		ajaxify.register_events([
			'user.count',
			'meta.getUsageStats',
			'user.getActiveUsers'
		]);

		socket.emit('user.count', updateUserCount);
		socket.on('user.count', updateUserCount);

		function updateUserCount(err, data) {
			$('#stats_users').html(utils.makeNumberHumanReadable(data.count)).attr('title', data.count);
		}

		socket.emit('meta.getUsageStats', updateUsageStats);
		socket.on('meta.getUsageStats', updateUsageStats);

		function updateUsageStats(err, data) {
			$('#stats_topics').html(utils.makeNumberHumanReadable(data.topics)).attr('title', data.topics);
			$('#stats_posts').html(utils.makeNumberHumanReadable(data.posts)).attr('title', data.posts);
		}

		socket.emit('user.getActiveUsers', updateActiveUsers);
		socket.on('user.getActiveUsers', updateActiveUsers);

		function updateActiveUsers(err, data) {
			$('#stats_online').html(data.users);
		}
	}

	return home;
});
