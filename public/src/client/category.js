'use strict';

define('forum/category', [
	'forum/infinitescroll',
	'share',
	'navigator',
	'topicList',
	'sort',
	'categorySelector',
], function (infinitescroll, share, navigator, topicList, sort, categorySelector) {
	var Category = {};

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (!String(data.url).startsWith('category/')) {
			navigator.disable();
		}
	});

	Category.init = function () {
		var	cid = ajaxify.data.cid;

		app.enterRoom('category_' + cid);

		share.addShareHandlers(ajaxify.data.name);

		topicList.init('category', loadTopicsAfter);

		sort.handleSort('categoryTopicSort', 'category/' + ajaxify.data.slug);

		if (!config.usePagination) {
			navigator.init('[component="category/topic"]', ajaxify.data.topic_count, Category.toTop, Category.toBottom, Category.navigatorCallback);
		} else {
			navigator.disable();
		}

		handleScrollToTopicIndex();

		handleIgnoreWatch(cid);

		handleLoadMoreSubcategories();

		categorySelector.init($('[component="category-selector"]'), {
			privilege: 'find',
			parentCid: ajaxify.data.cid,
			onSelect: function (category) {
				ajaxify.go('/category/' + category.cid);
			},
		});

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
		$(window).trigger('action:category.loaded', { cid: ajaxify.data.cid });
	};

	function handleScrollToTopicIndex() {
		var topicIndex = ajaxify.data.topicIndex;
		if (topicIndex && utils.isNumber(topicIndex)) {
			topicIndex = Math.max(0, parseInt(topicIndex, 10));
			if (topicIndex && window.location.search.indexOf('page=') === -1) {
				navigator.scrollToElement($('[component="category/topic"][data-index="' + topicIndex + '"]'), true, 0);
			}
		}
	}

	function handleIgnoreWatch(cid) {
		$('[component="category/watching"], [component="category/ignoring"], [component="category/notwatching"]').on('click', function () {
			var $this = $(this);
			var state = $this.attr('data-state');

			socket.emit('categories.setWatchState', { cid: cid, state: state }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				$('[component="category/watching/menu"]').toggleClass('hidden', state !== 'watching');
				$('[component="category/watching/check"]').toggleClass('fa-check', state === 'watching');

				$('[component="category/notwatching/menu"]').toggleClass('hidden', state !== 'notwatching');
				$('[component="category/notwatching/check"]').toggleClass('fa-check', state === 'notwatching');

				$('[component="category/ignoring/menu"]').toggleClass('hidden', state !== 'ignoring');
				$('[component="category/ignoring/check"]').toggleClass('fa-check', state === 'ignoring');

				app.alertSuccess('[[category:' + state + '.message]]');
			});
		});
	}

	function handleLoadMoreSubcategories() {
		$('[component="category/load-more-subcategories"]').on('click', function () {
			var btn = $(this);
			socket.emit('categories.loadMoreSubCategories', {
				cid: ajaxify.data.cid,
				start: ajaxify.data.nextSubCategoryStart,
			}, function (err, data) {
				if (err) {
					return app.alertError(err);
				}
				btn.toggleClass('hidden', !data.length || data.length < ajaxify.data.subCategoriesPerPage);
				if (!data.length) {
					return;
				}
				app.parseAndTranslate('category', 'children', { children: data }, function (html) {
					html.find('.timeago').timeago();
					$('[component="category/subcategory/container"]').append(html);
					utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
					app.createUserTooltips(html);
					ajaxify.data.nextSubCategoryStart += ajaxify.data.subCategoriesPerPage;
					ajaxify.data.subCategoriesLeft -= data.length;
					btn.translateText('[[category:x-more-categories, ' + ajaxify.data.subCategoriesLeft + ']]');
				});
			});
			return false;
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

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};

		$(window).trigger('action:category.loading');
		var params = utils.params();
		infinitescroll.loadMore('categories.loadMore', {
			cid: ajaxify.data.cid,
			after: after,
			direction: direction,
			query: params,
			categoryTopicSort: config.categoryTopicSort,
		}, function (data, done) {
			$(window).trigger('action:category.loaded');
			callback(data, done);
		});
	}

	return Category;
});
