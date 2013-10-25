define(function() {
	var	Recent = {};

	Recent.newTopicCount = 0;
	Recent.newPostCount = 0;
	Recent.loadingMoreTopics = false;

	var active = '';

	Recent.init = function() {
		app.enter_room('recent_posts');

		ajaxify.register_events([
			'event:new_topic',
			'event:new_post'
		]);


		function getActiveSection() {
			var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length - 1];
			return active;
		}

		active = getActiveSection();

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		});

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		socket.on('event:new_topic', function(data) {

			++Recent.newTopicCount;
			Recent.updateAlertText();

		});

		socket.on('event:new_post', function(data) {
			++Recent.newPostCount;
			Recent.updateAlertText();
		});

		$(window).off('scroll').on('scroll', function() {
			var bottom = ($(document).height() - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !Recent.loadingMoreTopics) {
				Recent.loadMoreTopics();
			}
		});
	};

	Recent.updateAlertText = function() {
		var text = '';

		if (Recent.newTopicCount > 1)
			text = 'There are ' + Recent.newTopicCount + ' new topics';
		else if (Recent.newTopicCount === 1)
			text = 'There is 1 new topic';
		else
			text = 'There are no new topics';

		if (Recent.newPostCount > 1)
			text += ' and ' + Recent.newPostCount + ' new posts.';
		else if (Recent.newPostCount === 1)
			text += ' and 1 new post.';
		else
			text += ' and no new posts.';

		text += ' Click here to reload.';

		$('#new-topics-alert').html(text).removeClass('hide').fadeIn('slow');
	}

	Recent.onTopicsLoaded = function(topics) {

		var html = templates.prepare(templates['recent'].blocks['topics']).parse({
			topics: topics
		}),
			container = $('#topics-container');

		$('#category-no-topics').remove();

		container.append(html);
		$('span.timeago').timeago();
	}

	Recent.loadMoreTopics = function() {
		Recent.loadingMoreTopics = true;
		socket.emit('api:topics.loadMoreRecentTopics', {
			after: $('#topics-container').children('li').length,
			term: active
		}, function(data) {
			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded(data.topics);
			}
			Recent.loadingMoreTopics = false;
		});
	}

	return Recent;
});
