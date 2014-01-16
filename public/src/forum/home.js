define(function() {
	var	home = {};

	home.init = function() {

		ajaxify.register_events([
			'user.count',
			'meta.getUsageStats',
			'user.getActiveUsers'
		]);

		socket.emit('user.count', function(data) {
			$('#stats_users').html(utils.makeNumberHumanReadable(data.count)).attr('title', data.count);
		});

		socket.emit('meta.getUsageStats', function(data) {
			$('#stats_topics').html(utils.makeNumberHumanReadable(data.topics)).attr('title', data.topics);
			$('#stats_posts').html(utils.makeNumberHumanReadable(data.posts)).attr('title', data.posts);
		});

		socket.emit('user.getActiveUsers', function(data) {
			$('#stats_online').html(data.users);
		});
	}

	return home;
});
