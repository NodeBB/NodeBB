'use strict';

/* globals define, app, socket, utils */

define('forum/recent', ['forum/infinitescroll'], function(infinitescroll) {
	var	Recent = {};

	var newTopicCount = 0,
		newPostCount = 0;

	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data.url.indexOf('recent') !== 0) {
			Recent.removeListeners();
		}
	});

	Recent.init = function() {
		app.enterRoom('recent_posts');

		Recent.watchForNewPosts();

		$('#new-topics-alert').on('click', function() {
			$(this).addClass('hide');
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
	};

	Recent.loadMoreTopics = function(direction) {
		if(direction < 0 || !$('#topics-container').length) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreRecentTopics', {
			after: $('#topics-container').attr('data-nextstart')
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
			html.find('span.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded');
			callback();
		});
	};

	return Recent;
});
