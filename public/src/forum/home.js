define(function() {
	var	home = {};

	home.init = function() {

		ajaxify.register_events([
			'user.count',
			'post.stats',
			'api:user.active.get'
		]);

		socket.emit('user.count', {});
		socket.on('user.count', function(data) {
			$('#stats_users').html(utils.makeNumberHumanReadable(data.count)).attr('title', data.count);
		});

		socket.emit('post.stats');
		socket.on('post.stats', function(data) {
			$('#stats_topics').html(utils.makeNumberHumanReadable(data.topics)).attr('title', data.topics);
			$('#stats_posts').html(utils.makeNumberHumanReadable(data.posts)).attr('title', data.posts);
		});

		socket.emit('api:user.active.get');
		socket.on('api:user.active.get', function(data) {
			$('#stats_online').html(data.users);
		});
	}

	return home;
});
