'use strict';

define('topicList', [
	'forum/infinitescroll',
	'handleBack',
	'topicSelect',
	'categoryFilter',
	'tagFilter',
	'forum/category/tools',
	'hooks',
], function (infinitescroll, handleBack, topicSelect, categoryFilter, tagFilter, categoryTools, hooks) {
	const TopicList = {};
	let templateName = '';

	let newTopicCount = 0;
	let newPostCount = 0;

	let loadTopicsCallback;
	let topicListEl;

	const scheduledTopics = [];

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
		const states = ['watching', 'tracking'];
		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') {
			states.push('notwatching', 'ignoring');
		} else if (template !== 'unread') {
			states.push('notwatching');
		}

		categoryFilter.init($('[component="category/dropdown"]'), {
			states: states,
		});

		tagFilter.init($('[component="tag/filter"]'));

		if (!config.usePagination) {
			infinitescroll.init(TopicList.loadMoreTopics);
		}

		handleBack.init(function (after, handleBackCallback) {
			loadTopicsCallback(after, 1, function (data, loadCallback) {
				onTopicsLoaded(templateName, data, ajaxify.data.showSelect, 1, function () {
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

		hooks.fire('action:topics.loaded', { topics: ajaxify.data.topics });
	};

	function findTopicListElement() {
		return $('[component="category"]').filter(function (i, e) {
			return !$(e).parents('[widget-area],[data-widget-area]').length;
		});
	}

	TopicList.watchForNewPosts = function () {
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

	function onNewTopic(data) {
		const d = ajaxify.data;

		const categories = d.selectedCids &&
			d.selectedCids.length &&
			d.selectedCids.indexOf(parseInt(data.cid, 10)) === -1;
		const filterWatched = d.selectedFilter &&
			d.selectedFilter.filter === 'watched';
		const category = d.template.category &&
			parseInt(d.cid, 10) !== parseInt(data.cid, 10);

		const preventAlert = !!(categories || filterWatched || category || scheduledTopics.includes(data.tid));
		hooks.fire('filter:topicList.onNewTopic', { topic: data, preventAlert }).then((result) => {
			if (result.preventAlert) {
				return;
			}

			if (data.scheduled && data.tid) {
				scheduledTopics.push(data.tid);
			}
			newTopicCount += 1;
			updateAlertText();
		});
	}

	function onNewPost(data) {
		const post = data.posts[0];
		if (!post || !post.topic || post.topic.isFollowing) {
			return;
		}

		const d = ajaxify.data;

		const isMain = parseInt(post.topic.mainPid, 10) === parseInt(post.pid, 10);
		const categories = d.selectedCids &&
			d.selectedCids.length &&
			d.selectedCids.indexOf(parseInt(post.topic.cid, 10)) === -1;
		const filterNew = d.selectedFilter &&
			d.selectedFilter.filter === 'new';
		const filterWatched = d.selectedFilter &&
			d.selectedFilter.filter === 'watched' &&
			!post.topic.isFollowing;
		const category = d.template.category &&
			parseInt(d.cid, 10) !== parseInt(post.topic.cid, 10);

		const preventAlert = !!(isMain || categories || filterNew || filterWatched || category);
		hooks.fire('filter:topicList.onNewPost', { post, preventAlert }).then((result) => {
			if (result.preventAlert) {
				return;
			}

			newPostCount += 1;
			updateAlertText();
		});
	}

	function updateAlertText() {
		if (newTopicCount > 0 || newPostCount > 0) {
			$('#new-topics-alert').removeClass('hide').fadeIn('slow');
			$('#category-no-topics').addClass('hide');
		}
	}

	TopicList.loadMoreTopics = function (direction) {
		if (!topicListEl.length || !topicListEl.children().length) {
			return;
		}
		const topics = topicListEl.find('[component="category/topic"]');
		const afterEl = direction > 0 ? topics.last() : topics.first();
		const after = (parseInt(afterEl.attr('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);

		if (!utils.isNumber(after) || (after === 0 && topicListEl.find('[component="category/topic"][data-index="0"]').length)) {
			return;
		}

		loadTopicsCallback(after, direction, function (data, done) {
			onTopicsLoaded(templateName, data, ajaxify.data.showSelect, direction, done);
		});
	};

	function calculateNextPage(after, direction) {
		return Math.floor(after / config.topicsPerPage) + (direction > 0 ? 1 : 0);
	}

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};
		const query = utils.params();
		query.page = calculateNextPage(after, direction);
		infinitescroll.loadMoreXhr(query, callback);
	}

	function filterTopicsOnDom(topics) {
		return topics.filter(function (topic) {
			return !topicListEl.find('[component="category/topic"][data-tid="' + topic.tid + '"]').length;
		});
	}

	function onTopicsLoaded(templateName, data, showSelect, direction, callback) {
		let { topics } = data;
		if (!topics || !topics.length) {
			$('#load-more-btn').hide();
			return callback();
		}
		topics = filterTopicsOnDom(topics);

		if (!topics.length) {
			$('#load-more-btn').hide();
			return callback();
		}

		let after;
		let before;
		const topicEls = topicListEl.find('[component="category/topic"]');

		if (direction > 0 && topics.length) {
			after = topicEls.last();
		} else if (direction < 0 && topics.length) {
			before = topicEls.first();
		}

		const tplData = {
			topics: topics,
			showSelect: showSelect,
			'reputation:disabled': data['reputation:disabled'],
			template: {
				name: templateName,
			},
		};
		tplData.template[templateName] = true;

		hooks.fire('action:topics.loading', { topics: topics, after: after, before: before });

		app.parseAndTranslate(templateName, 'topics', tplData, function (html) {
			topicListEl.removeClass('hidden');
			$('#category-no-topics').remove();

			if (after && after.length) {
				html.insertAfter(after);
			} else if (before && before.length) {
				const height = $(document).height();
				const scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				topicListEl.append(html);
			}

			if (!topicSelect.getSelectedTids().length) {
				infinitescroll.removeExtra(topicListEl.find('[component="category/topic"]'), direction, Math.max(60, config.topicsPerPage * 3));
			}

			html.find('.timeago').timeago();
			hooks.fire('action:topics.loaded', { topics: topics, template: templateName });
			callback();
		});
	}

	return TopicList;
});
