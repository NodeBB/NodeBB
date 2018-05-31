'use strict';


define('forum/category', [
	'forum/infinitescroll',
	'share',
	'navigator',
	'forum/category/tools',
	'forum/recent',
	'sort',
	'components',
	'translator',
	'topicSelect',
	'handleBack',
], function (infinitescroll, share, navigator, categoryTools, recent, sort, components, translator, topicSelect, handleBack) {
	var Category = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (!String(data.url).startsWith('category/')) {
			navigator.disable();

			removeListeners();
		}
	});

	function removeListeners() {
		categoryTools.removeListeners();
		recent.removeListeners();
	}

	Category.init = function () {
		var	cid = ajaxify.data.cid;

		app.enterRoom('category_' + cid);

		share.addShareHandlers(ajaxify.data.name);

		categoryTools.init(cid);
		recent.watchForNewPosts();

		sort.handleSort('categoryTopicSort', 'user.setCategorySort', 'category/' + ajaxify.data.slug);

		enableInfiniteLoadingOrPagination();

		handleBack.init(function (after, cb) {
			loadTopicsAfter(after, 1, cb);
		});

		handleScrollToTopicIndex();

		handleIgnoreWatch(cid);

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
		$(window).trigger('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function handleScrollToTopicIndex() {
		var parts = window.location.pathname.split('/');
		var topicIndex = parts[parts.length - 1];
		if (topicIndex && utils.isNumber(topicIndex)) {
			topicIndex = Math.max(0, parseInt(topicIndex, 10) - 1);
			if (topicIndex && window.location.search.indexOf('page=') === -1) {
				navigator.scrollToElement($('[component="category/topic"][data-index="' + topicIndex + '"]'), true, 0);
			}
		}
	}

	function handleIgnoreWatch(cid) {
		$('[component="category/watching"], [component="category/ignoring"]').on('click', function () {
			var $this = $(this);
			var command = $this.attr('component') === 'category/watching' ? 'watch' : 'ignore';

			socket.emit('categories.' + command, cid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				$('[component="category/watching/menu"]').toggleClass('hidden', command !== 'watch');
				$('[component="category/watching/check"]').toggleClass('fa-check', command === 'watch');

				$('[component="category/ignoring/menu"]').toggleClass('hidden', command !== 'ignore');
				$('[component="category/ignoring/check"]').toggleClass('fa-check', command === 'ignore');

				app.alertSuccess('[[category:' + command + '.message]]');
			});
		});
	}

	Category.toTop = function () {
		navigator.scrollTop(0);
	};

	Category.toBottom = function () {
		socket.emit('categories.getTopicCount', ajaxify.data.cid, function (err, count) {
			if (err) {
				return app.alertError(err.message);
			}

			navigator.scrollBottom(count - 1);
		});
	};

	Category.navigatorCallback = function (topIndex, bottomIndex) {
		return bottomIndex;
	};

	function enableInfiniteLoadingOrPagination() {
		if (!config.usePagination) {
			navigator.init('[component="category/topic"]', ajaxify.data.topic_count, Category.toTop, Category.toBottom, Category.navigatorCallback);
			infinitescroll.init($('[component="category"]'), Category.loadMoreTopics);
		} else {
			navigator.disable();
		}
	}

	Category.loadMoreTopics = function (direction) {
		if (!$('[component="category"]').length || !$('[component="category"]').children().length) {
			return;
		}

		var topics = $('[component="category/topic"]');
		var afterEl = direction > 0 ? topics.last() : topics.first();
		var after = (parseInt(afterEl.attr('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);

		loadTopicsAfter(after, direction);
	};

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};
		if (!utils.isNumber(after) || (after === 0 && components.get('category/topic', 'index', 0).length)) {
			return callback();
		}

		$(window).trigger('action:category.loading');
		var params = utils.params();
		infinitescroll.loadMore('categories.loadMore', {
			cid: ajaxify.data.cid,
			after: after,
			direction: direction,
			query: params,
			categoryTopicSort: config.categoryTopicSort,
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				Category.onTopicsLoaded(data, direction, done);
			} else {
				done();
			}

			$(window).trigger('action:category.loaded');
			callback();
		});
	}


	Category.onTopicsLoaded = function (data, direction, callback) {
		if (!data || !data.topics.length) {
			return callback();
		}

		function removeAlreadyAddedTopics(topics) {
			return topics.filter(function (topic) {
				return components.get('category/topic', 'tid', topic.tid).length === 0;
			});
		}

		data.topics = removeAlreadyAddedTopics(data.topics);
		if (!data.topics.length) {
			return callback();
		}

		data.showSelect = data.privileges.editable;

		var after;
		var before;
		var topics = $('[component="category/topic"]');

		if (direction > 0 && topics.length) {
			after = topics.last();
		} else if (direction < 0 && topics.length) {
			before = topics.first();
		}

		app.parseAndTranslate('category', 'topics', data, function (html) {
			$('[component="category"]').removeClass('hidden');
			$('.category-sidebar').removeClass('hidden');

			$('#category-no-topics').remove();

			if (after) {
				html.insertAfter(after);
			} else if (before) {
				var height = $(document).height();
				var scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				$('[component="category"]').append(html);
			}

			if (!topicSelect.getSelectedTids().length) {
				infinitescroll.removeExtra($('[component="category/topic"]'), direction, config.topicsPerPage * 3);
			}

			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));

			$(window).trigger('action:topics.loaded', { topics: data.topics });

			callback();
		});
	};

	return Category;
});
