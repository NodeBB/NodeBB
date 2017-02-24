'use strict';


define('forum/recent', ['forum/infinitescroll', 'components'], function (infinitescroll, components) {
	var	Recent = {};

	var newTopicCount = 0;
	var newPostCount = 0;

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			Recent.removeListeners();
		}
	});

	Recent.init = function () {
		app.enterRoom('recent_topics');

		Recent.watchForNewPosts();

		$('#new-topics-alert').on('click', function () {
			$(this).addClass('hide');
		});

		if (!config.usePagination) {
			infinitescroll.init(Recent.loadMoreTopics);
		}

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
	};

	Recent.watchForNewPosts = function () {
		newPostCount = 0;
		newTopicCount = 0;
		Recent.removeListeners();
		socket.on('event:new_topic', onNewTopic);
		socket.on('event:new_post', onNewPost);
	};

	function onNewTopic(data) {
		if (ajaxify.data.selectedCategory && parseInt(ajaxify.data.selectedCategory.cid, 10) !== parseInt(data.cid, 10)) {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') {
			return;
		}

		newTopicCount += 1;
		Recent.updateAlertText();
	}

	function onNewPost(data) {
		function showAlert() {
			newPostCount += 1;
			Recent.updateAlertText();
		}

		var post = data.posts[0];
		if (!post || !post.topic) {
			return;
		}
		if (parseInt(post.topic.mainPid, 10) === parseInt(post.pid, 10)) {
			return;
		}

		if (ajaxify.data.selectedCategory && parseInt(ajaxify.data.selectedCategory.cid, 10) !== parseInt(post.topic.cid, 10)) {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'new') {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') {
			socket.emit('topics.isFollowed', post.tid, function (err, isFollowed) {
				if (err) {
					app.alertError(err.message);
				}
				if (isFollowed) {
					showAlert();
				}
			});
			return;
		}

		showAlert();
	}

	Recent.removeListeners = function () {
		socket.removeListener('event:new_topic', onNewTopic);
		socket.removeListener('event:new_post', onNewPost);
	};

	Recent.updateAlertText = function () {
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
				text = '[[recent:there-is-a-new-topic-and-new-posts, ' + newPostCount + ']]';
			}
		} else if (newTopicCount > 1) {
			if (newPostCount === 0) {
				text = '[[recent:there-are-new-topics, ' + newTopicCount + ']]';
			} else if (newPostCount === 1) {
				text = '[[recent:there-are-new-topics-and-a-new-post, ' + newTopicCount + ']]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-are-new-topics-and-new-posts, ' + newTopicCount + ', ' + newPostCount + ']]';
			}
		}

		text += ' [[recent:click-here-to-reload]]';

		$('#new-topics-alert').translateText(text).removeClass('hide').fadeIn('slow');
		$('#category-no-topics').addClass('hide');
	};

	Recent.loadMoreTopics = function (direction) {
		if (direction < 0 || !$('[component="category"]').length) {
			return;
		}

		infinitescroll.loadMore('topics.loadMoreRecentTopics', {
			after: $('[component="category"]').attr('data-nextstart'),
			cid: utils.params().cid,
			filter: ajaxify.data.selectedFilter.filter,
			set: $('[component="category"]').attr('data-set') ? $('[component="category"]').attr('data-set') : 'topics:recent',
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded('recent', data.topics, false, done);
			} else {
				done();
			}
			$('[component="category"]').attr('data-nextstart', data.nextStart);
		});
	};

	Recent.onTopicsLoaded = function (templateName, topics, showSelect, callback) {
		topics = topics.filter(function (topic) {
			return !components.get('category/topic', 'tid', topic.tid).length;
		});

		if (!topics.length) {
			return callback();
		}

		app.parseAndTranslate(templateName, 'topics', { topics: topics, showSelect: showSelect }, function (html) {
			$('#category-no-topics').remove();

			$('[component="category"]').append(html);
			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded', { topics: topics });
			callback();
		});
	};

	return Recent;
});
