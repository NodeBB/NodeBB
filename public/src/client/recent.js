'use strict';

/* globals define, app, socket, utils */

define('forum/recent', ['forum/infinitescroll', 'composer'], function(infinitescroll, composer) {
	var	Recent = {};

	var newTopicCount = 0,
		newPostCount = 0;

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (ajaxify.currentPage !== data.url) {
			Recent.removeListeners();
		}
	});

	Recent.init = function() {
		app.enterRoom('recent_posts');

		Recent.watchForNewPosts();

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
		});

		$('#new_topic').on('click', function() {
			socket.emit('categories.getCategoriesByPrivilege', 'topics:create', function(err, categories) {
				if (err) {
					return app.alertError(err.message);
				}
				if (categories.length) {
					composer.newTopic(categories[0].cid);
				}
			});
		});

		infinitescroll.init(Recent.loadMoreTopics);
	};

	Recent.watchForNewPosts = function () {
		newPostCount = 0;
		newTopicCount = 0;
		Recent.removeListeners();
		socket.on('event:new_topic', onNewTopic);
		socket.on('event:new_post', onNewPost);
	};

	function onNewTopic(data) {
		++newTopicCount;
		Recent.updateAlertText();
	}

	function onNewPost(data) {
		++newPostCount;
		Recent.updateAlertText();
	}

	Recent.removeListeners = function() {
		socket.removeListener('event:new_topic', onNewTopic);
		socket.removeListener('event:new_post', onNewPost);
	};

	Recent.updateAlertText = function() {
		var text = '';

		if (newTopicCount === 0) {
			if (newPostCount === 1) {
				text = '[[recent:there-is-a-new-post]]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-are-new-posts, ' + newPostCount + ']]';
			}
		} else if (newTopicCount === 1) {
			if (newPostCount === 0) {
				text = '[[recent:there-is-a-new-topic]]';
			} else if (newPostCount === 1) {
				text = '[[recent:there-is-a-new-topic-and-a-new-post]]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-is-a-new-topic-and-new-posts, ' + newPostCount +']]';
			}
		} else if (newTopicCount > 1) {
			if (newPostCount === 0) {
				text = '[[recent:there-are-new-topics, ' + newTopicCount + ']]';
			} else if (newPostCount === 1) {
				text = '[[recent:there-are-new-topics-and-a-new-post, ' + newTopicCount + ']]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-are-new-topics-and-new-posts, ' + newTopicCount + ', ' + newPostCount +']]';
			}
		}

		text += ' [[recent:click-here-to-reload]]';

		$('#new-topics-alert').translateText(text).removeClass('hide').fadeIn('slow');
		$('#category-no-topics').addClass('hide');
	};

	Recent.loadMoreTopics = function(direction) {
		if(direction < 0 || !$('#topics-container').length) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreFromSet', {
			after: $('#topics-container').attr('data-nextstart'),
			set: 'topics:recent'
		}, function(data, done) {
			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded('recent', data.topics, false, done);
				$('#topics-container').attr('data-nextstart', data.nextStart);
			} else {
				done();
			}
		});
	};

	Recent.onTopicsLoaded = function(templateName, topics, showSelect, callback) {

		topics = topics.filter(function(topic) {
			return !$('#topics-container li[data-tid=' + topic.tid + ']').length;
		});

		if (!topics.length) {
			return callback();
		}

		infinitescroll.parseAndTranslate(templateName, 'topics', {topics: topics, showSelect: showSelect}, function(html) {
			$('#category-no-topics').remove();

			$('#topics-container').append(html);
			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded');
			callback();
		});
	};

	return Recent;
});
