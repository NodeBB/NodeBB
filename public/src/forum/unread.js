(function() {
	var loadingMoreTopics = false;

	app.enter_room('recent_posts');

	ajaxify.register_events([
		'event:new_topic',
		'event:new_post'
	]);

	var newTopicCount = 0,
		newPostCount = 0;

	$('#new-topics-alert').on('click', function() {
		$(this).hide();
	});

	socket.on('event:new_topic', function(data) {

		++newTopicCount;
		updateAlertText();

	});

	function updateAlertText() {
		var text = '';

		if (newTopicCount > 1)
			text = 'There are ' + newTopicCount + ' new topics';
		else if (newTopicCount === 1)
			text = 'There is 1 new topic';
		else
			text = 'There are no new topics';

		if (newPostCount > 1)
			text += ' and ' + newPostCount + ' new posts.';
		else if (newPostCount === 1)
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
		var btn = $(this);
		socket.emit('api:topics.markAllRead', {}, function(success) {
			if (success) {
				btn.remove();
				$('#topics-container').empty();
				$('#category-no-topics').removeClass('hidden');
				app.alertSuccess('All topics marked as read!');
				$('#numUnreadBadge')
					.removeClass('badge-important')
					.addClass('badge-inverse')
					.html('0');
			} else {
				app.alertError('There was an error marking topics read!');
			}
		});
	});

	function onTopicsLoaded(topics) {

		var html = templates.prepare(templates['unread'].blocks['topics']).parse({
			topics: topics
		}),
			container = $('#topics-container');

		$('#category-no-topics').remove();

		container.append(html);
	}

	function loadMoreTopics() {
		loadingMoreTopics = true;
		socket.emit('api:topics.loadMoreUnreadTopics', {
			after: parseInt($('#topics-container').attr('data-next-start'), 10)
		}, function(data) {
			if (data.topics && data.topics.length) {
				onTopicsLoaded(data.topics);
				$('#topics-container').attr('data-next-start', data.nextStart);
			} else {
				$('#load-more-btn').hide();
			}

			loadingMoreTopics = false;
		});
	}

	$(window).off('scroll').on('scroll', function() {
		var bottom = ($(document).height() - $(window).height()) * 0.9;

		if ($(window).scrollTop() > bottom && !loadingMoreTopics) {
			loadMoreTopics();
		}
	});


	if ($("body").height() <= $(window).height() && $('#topics-container').children().length >= 20)
		$('#load-more-btn').show();

	$('#load-more-btn').on('click', function() {
		loadMoreTopics();
	});

})();