'use strict';

define('topicList', [
	'forum/infinitescroll',
	'handleBack',
	'topicSelect',
	'categoryFilter',
	'forum/category/tools',
], function (infinitescroll, handleBack, topicSelect, categoryFilter, categoryTools) {
	var TopicList = {};
	var templateName = '';

	var tplToSort = {
		recent: 'recent',
		unread: 'unread',
		popular: 'posts',
		top: 'votes',
	};

	var newTopicCount = 0;
	var newPostCount = 0;

	var loadTopicsCallback;
	var topicListEl;

	$(window).on('action:ajaxify.start', function () {
		TopicList.removeListeners();
		categoryTools.removeListeners();
	});

	TopicList.init = function (template, cb) {
		topicListEl = findTopicListElement();

		templateName = template;
		loadTopicsCallback = cb || loadTopicsAfter;

		categoryTools.init();

		TopicList.watchForNewPosts();

		categoryFilter.init($('[component="category/dropdown"]'));

		if (!config.usePagination) {
			infinitescroll.init(TopicList.loadMoreTopics);
		}

		handleBack.init(function (after, handleBackCallback) {
			loadTopicsCallback(after, 1, function (data, loadCallback) {
				TopicList.onTopicsLoaded(templateName, data.topics, ajaxify.data.showSelect, 1, function () {
					handleBackCallback();
					loadCallback();
				});
			});
		});

		if ($('body').height() <= $(window).height() && topicListEl.children().length >= 20) {
			$('#load-more-btn').show();
		}

		$('#load-more-btn').on('click', function () {
			TopicList.loadMoreTopics(1);
		});

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
	};

	function findTopicListElement() {
		return $('[component="category"]').filter(function (i, e) {
			return !$(e).parents('[widget-area],[data-widget-area]').length;
		});
	}

	TopicList.watchForNewPosts = function () {
		$('#new-topics-alert').on('click', function () {
			$(this).addClass('hide');
		});
		newPostCount = 0;
		newTopicCount = 0;
		TopicList.removeListeners();
		socket.on('event:new_topic', onNewTopic);
		socket.on('event:new_post', onNewPost);
	};

	TopicList.removeListeners = function () {
		socket.removeListener('event:new_topic', onNewTopic);
		socket.removeListener('event:new_post', onNewPost);
	};

	function isCategoryVisible(cid) {
		return ajaxify.data.categories && ajaxify.data.categories.length && ajaxify.data.categories.some(function (c) {
			return parseInt(c.cid, 10) === parseInt(cid, 10);
		});
	}

	function onNewTopic(data) {
		if (
			(ajaxify.data.selectedCids && ajaxify.data.selectedCids.length && ajaxify.data.selectedCids.indexOf(parseInt(data.cid, 10)) === -1) ||
			(ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') ||
			(ajaxify.data.template.category && parseInt(ajaxify.data.cid, 10) !== parseInt(data.cid, 10)) ||
			(!isCategoryVisible(data.cid))
		) {
			return;
		}

		newTopicCount += 1;
		updateAlertText();
	}

	function onNewPost(data) {
		var post = data.posts[0];
		if (!post || !post.topic) {
			return;
		}
		if (!post.topic.isFollowing && (
			(parseInt(post.topic.mainPid, 10) === parseInt(post.pid, 10)) ||
			(ajaxify.data.selectedCids && ajaxify.data.selectedCids.length && ajaxify.data.selectedCids.indexOf(parseInt(post.topic.cid, 10)) === -1) ||
			(ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'new') ||
			(ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched' && !post.topic.isFollowing) ||
			(ajaxify.data.template.category && parseInt(ajaxify.data.cid, 10) !== parseInt(post.topic.cid, 10)) ||
			(!isCategoryVisible(post.topic.cid))
		)) {
			return;
		}

		newPostCount += 1;
		updateAlertText();
	}

	function updateAlertText() {
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
	}

	TopicList.loadMoreTopics = function (direction) {
		if (!topicListEl.length || !topicListEl.children().length) {
			return;
		}
		var topics = topicListEl.find('[component="category/topic"]');
		var afterEl = direction > 0 ? topics.last() : topics.first();
		var after = (parseInt(afterEl.attr('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);

		if (!utils.isNumber(after) || (after === 0 && topicListEl.find('[component="category/topic"][data-index="0"]').length)) {
			return;
		}

		loadTopicsCallback(after, direction, function (data, done) {
			TopicList.onTopicsLoaded(templateName, data.topics, ajaxify.data.showSelect, direction, done);
		});
	};

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};
		var query = utils.params();
		infinitescroll.loadMore('topics.loadMoreSortedTopics', {
			after: after,
			direction: direction,
			sort: tplToSort[templateName],
			count: config.topicsPerPage,
			cid: query.cid,
			query: query,
			term: ajaxify.data.selectedTerm && ajaxify.data.selectedTerm.term,
			filter: ajaxify.data.selectedFilter.filter,
			set: topicListEl.attr('data-set') ? topicListEl.attr('data-set') : 'topics:recent',
		}, callback);
	}

	function filterTopicsOnDom(topics) {
		return topics.filter(function (topic) {
			return !topicListEl.find('[component="category/topic"][data-tid="' + topic.tid + '"]').length;
		});
	}

	TopicList.onTopicsLoaded = function (templateName, topics, showSelect, direction, callback) {
		if (!topics || !topics.length) {
			$('#load-more-btn').hide();
			return callback();
		}
		topics = filterTopicsOnDom(topics);

		if (!topics.length) {
			$('#load-more-btn').hide();
			return callback();
		}

		var after;
		var before;
		var topicEls = topicListEl.find('[component="category/topic"]');

		if (direction > 0 && topics.length) {
			after = topicEls.last();
		} else if (direction < 0 && topics.length) {
			before = topicEls.first();
		}

		var tplData = {
			topics: topics,
			showSelect: showSelect,
			template: {
				name: templateName,
			},
		};
		tplData.template[templateName] = true;

		app.parseAndTranslate(templateName, 'topics', tplData, function (html) {
			topicListEl.removeClass('hidden');
			$('#category-no-topics').remove();

			if (after && after.length) {
				html.insertAfter(after);
			} else if (before && before.length) {
				var height = $(document).height();
				var scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				topicListEl.append(html);
			}

			if (!topicSelect.getSelectedTids().length) {
				infinitescroll.removeExtra(topicListEl.find('[component="category/topic"]'), direction, 60);
			}

			html.find('.timeago').timeago();
			app.createUserTooltips(html);
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded', { topics: topics, template: templateName });
			callback();
		});
	};

	return TopicList;
});
