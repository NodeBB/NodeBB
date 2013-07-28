(function() {
	app.enter_room('recent_posts');

	ajaxify.register_events([
		'event:new_topic',
		'event:new_post'
	]);

	var newTopicCount = 0, newPostCount = 0;

	$('#new-topics-alert').on('click', function() {
		$(this).hide();
	});

	socket.on('event:new_topic', function(data) {
		
		++newTopicCount;
		updateAlertText();
	
	});
	
	function updateAlertText() {
		var text = '';
		
		if(newTopicCount > 1)
			text = 'There are ' + newTopicCount + ' new topics';
		else if(newTopicCount === 1)
			text = 'There is 1 new topic';
		else
			text = 'There are no new topics';
			
		if(newPostCount > 1)
			text += ' and ' + newPostCount + ' new posts.';
		else if(newPostCount === 1)
			text += ' and 1 new post.';
		else
			text += ' and no new posts.';

		text += ' Click here to reload.';

		$('#new-topics-alert').html(text).fadeIn('slow');
	}
	
	socket.on('event:new_post', function(data) {
		++newPostCount;
		updateAlertText();
	});
	
	$('#mark-allread-btn').on('click', function() {
		socket.emit('api:topics.markAllRead');
		$(this).remove();
		$('#topics-container').empty();
		$('#category-no-topics').removeClass('hidden');
	});

})();