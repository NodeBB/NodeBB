'use strict';

define('handleBack', [
	'components',
	'storage',
	'navigator',
	'forum/pagination',
], function (components, storage, navigator, pagination) {
	var handleBack = {};
	var loadTopicsMethod;

	handleBack.init = function (_loadTopicsMethod) {
		loadTopicsMethod = _loadTopicsMethod;
		saveClickedIndex();
		$(window).off('action:popstate', onBackClicked).on('action:popstate', onBackClicked);
	};

	function saveClickedIndex() {
		$('[component="category"]').on('click', '[component="topic/header"]', function () {
			var clickedIndex = $(this).parents('[data-index]').attr('data-index');
			$('[component="category/topic"]').each(function (index, el) {
				if ($(el).offset().top - $(window).scrollTop() > 0) {
					storage.setItem('category:bookmark', $(el).attr('data-index'));
					storage.setItem('category:bookmark:clicked', clickedIndex);
					return false;
				}
			});
		});
	}

	function onBackClicked() {
		if ((ajaxify.data.template.category || ajaxify.data.template.recent)) {
			var bookmarkIndex = storage.getItem('category:bookmark');
			var clickedIndex = storage.getItem('category:bookmark:clicked');

			storage.removeItem('category:bookmark');
			storage.removeItem('category:bookmark:clicked');
			if (!utils.isNumber(bookmarkIndex)) {
				return;
			}

			bookmarkIndex = Math.max(0, parseInt(bookmarkIndex, 10) || 0);
			clickedIndex = Math.max(0, parseInt(clickedIndex, 10) || 0);

			if (!bookmarkIndex && !clickedIndex) {
				return;
			}

			if (config.usePagination) {
				var page = Math.ceil((parseInt(bookmarkIndex, 10) + 1) / config.topicsPerPage);
				if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
					pagination.loadPage(page, function () {
						handleBack.scrollToTopic(bookmarkIndex, clickedIndex, 0);
					});
				} else {
					handleBack.scrollToTopic(bookmarkIndex, clickedIndex, 0);
				}
			} else {
				if (bookmarkIndex === 0) {
					handleBack.highlightTopic(clickedIndex);
					return;
				}

				$('[component="category"]').empty();
				loadTopicsMethod(Math.max(0, bookmarkIndex - 1) + 1, function () {
					$(window).one('action:topics.loaded', function () {
						handleBack.scrollToTopic(bookmarkIndex, clickedIndex, 0);
					});
				});
			}
		}
	}

	handleBack.highlightTopic = function (topicIndex) {
		var highlight = components.get('category/topic', 'index', topicIndex);

		if (highlight.length && !highlight.hasClass('highlight')) {
			highlight.addClass('highlight');
			setTimeout(function () {
				highlight.removeClass('highlight');
			}, 5000);
		}
	};

	handleBack.scrollToTopic = function (bookmarkIndex, clickedIndex, duration, offset) {
		if (!utils.isNumber(bookmarkIndex)) {
			return;
		}

		if (!offset) {
			offset = 0;
		}

		var scrollTo = components.get('category/topic', 'index', bookmarkIndex);

		if (scrollTo.length) {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top - offset) + 'px',
			}, duration !== undefined ? duration : 400, function () {
				handleBack.highlightTopic(clickedIndex);
				navigator.update();
			});
		}
	};

	return handleBack;
});
