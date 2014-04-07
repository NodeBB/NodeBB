define(function() {
	var	Recent = {};

	var newTopicCount = 0,
		newPostCount = 0,
		loadingMoreTopics = false;

	var active = '';

	function getActiveSection() {
		var url = window.location.href,
		parts = url.split('/'),
		active = parts[parts.length - 1];
		return active;
	}

	Recent.init = function() {
		app.enterRoom('recent_posts');

		Recent.watchForNewPosts();


		active = Recent.selectActivePill();


		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});


		app.enableInfiniteLoading(function() {
			if(!loadingMoreTopics) {
				Recent.loadMoreTopics();
			}
		});
	};

	Recent.selectActivePill = function() {
		var active = getActiveSection();

		$('.nav-pills li').removeClass('active');
		$('.nav-pills li a').each(function() {
			var $this = $(this);
			if ($this.attr('href').match(active)) {
				$this.parent().addClass('active');
				return false;
			}
		});

		return active;
	}

	Recent.watchForNewPosts = function () {

		newPostCount = 0;
		newTopicCount = 0;

		ajaxify.register_events([
			'event:new_topic',
			'event:new_post'
		]);

		socket.on('event:new_topic', function(data) {
			++newTopicCount;
			Recent.updateAlertText();
		});

		socket.on('event:new_post', function(data) {
			++newPostCount;
			Recent.updateAlertText();
		});
	}

	Recent.updateAlertText = function() {
		var text = 'There';

		if (newTopicCount > 1) {
			text += ' are ' + newTopicCount + ' new topics';
		} else if (newTopicCount === 1) {
			text += ' is a new topic';
		}

		if (newPostCount > 1) {
			text += (newTopicCount?' and ':' are ') + newPostCount + ' new posts';
		} else if(newPostCount === 1) {
			text += (newTopicCount?' and ':' is ') + ' a new post';
		}

		text += '. Click here to reload.';

		$('#new-topics-alert').html(text).removeClass('hide').fadeIn('slow');
		$('#category-no-topics').addClass('hide');
	}

	Recent.loadMoreTopics = function() {
		if(!$('#topics-container').length) {
			return;
		}

		loadingMoreTopics = true;
		socket.emit('topics.loadMoreRecentTopics', {
			after: $('#topics-container').attr('data-nextstart'),
			term: active
		}, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}

			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded('recent', data.topics);
				$('#topics-container').attr('data-nextstart', data.nextStart);
			}

			loadingMoreTopics = false;
		});
	}

	Recent.onTopicsLoaded = function(templateName, topics) {
		ajaxify.loadTemplate(templateName, function(template) {
			var html = templates.parse(templates.getBlock(template, 'topics'), {topics: topics});

			translator.translate(html, function(translatedHTML) {
				$('#category-no-topics').remove();

				html = $(translatedHTML);
				$('#topics-container').append(html);
				html.find('span.timeago').timeago();
				app.createUserTooltips();
				utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	}

	return Recent;
});
