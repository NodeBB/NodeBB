define(function() {
	var	Recent = {};

	Recent.newTopicCount = 0;
	Recent.newPostCount = 0;
	Recent.loadingMoreTopics = false;

	var active = '';

	Recent.init = function() {
		app.enterRoom('recent_posts');

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
		var text = 'There';

		if (Recent.newTopicCount > 1) {
			text += ' are ' + Recent.newTopicCount + ' new topics';
		} else if (Recent.newTopicCount === 1) {
			text += ' is a new topic';
		}

		if (Recent.newPostCount > 1) {
			text += (Recent.newTopicCount?' and ':' are ') + Recent.newPostCount + ' new posts';
		} else if(newPostCount === 1) {
			text += (Recent.newTopicCount?' and ':' is ') + ' a new post';
		}

		text += '. Click here to reload.';

		$('#new-topics-alert').html(text).removeClass('hide').fadeIn('slow');
	}

	Recent.onTopicsLoaded = function(topics) {
		var html = templates.prepare(templates['recent'].blocks['topics']).parse({
			topics: topics
		});

		translator.translate(html, function(translatedHTML) {
			var container = $('#topics-container');

			$('#category-no-topics').remove();

			html = $(translatedHTML);
			container.append(html);
			$('span.timeago').timeago();
			app.createUserTooltips();
			app.makeNumbersHumanReadable(html.find('.human-readable-number'));
		});
	}

	Recent.loadMoreTopics = function() {
		Recent.loadingMoreTopics = true;
		socket.emit('topics.loadMoreRecentTopics', {
			after: $('#topics-container').children('li').length,
			term: active
		}, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}
			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded(data.topics);
			}
			Recent.loadingMoreTopics = false;
		});
	}

	return Recent;
});
