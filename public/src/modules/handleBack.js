'use strict';

define('handleBack', [
	'components',
	'storage',
	'navigator',
	'forum/pagination',
], function (components, storage, navigator, pagination) {
	const handleBack = {};
	let loadTopicsMethod;
	const elements = new Map();
	const defaults = new Map([
		['container', '[component="category"]'],
	]);

	handleBack.init = function (_loadTopicsMethod, _elements = {}) {
		loadTopicsMethod = _loadTopicsMethod;
		['container'].forEach((prop) => {
			elements.set(prop, _elements[prop] || defaults.get(prop));
		});

		saveClickedIndex();
		$(window).off('action:popstate', onBackClicked).on('action:popstate', onBackClicked);
	};

	handleBack.onBackClicked = onBackClicked;

	function saveClickedIndex() {
		$(elements.get('container')).on('click', '[data-index]', function () {
			const clickedIndex = $(this).attr('data-index');
			const windowScrollTop = $(window).scrollTop();
			$(elements.get('container')).find('[data-index]').each(function (index, el) {
				if ($(el).offset().top - windowScrollTop > 0) {
					storage.setItem('category:bookmark', $(el).attr('data-index'));
					storage.setItem('category:bookmark:clicked', clickedIndex);
					storage.setItem('category:bookmark:offset', $(el).offset().top - windowScrollTop);
					return false;
				}
			});
		});
	}

	function onBackClicked(isMarkedUnread) {
		const highlightUnread = isMarkedUnread && ajaxify.data.template.unread;
		if (
			ajaxify.data.template.category ||
			ajaxify.data.template.recent ||
			ajaxify.data.template.popular ||
			ajaxify.data.template.world ||
			highlightUnread
		) {
			let bookmarkIndex = storage.getItem('category:bookmark');
			let clickedIndex = storage.getItem('category:bookmark:clicked');

			storage.removeItem('category:bookmark');
			storage.removeItem('category:bookmark:clicked');
			if (!utils.isNumber(bookmarkIndex)) {
				return;
			}

			bookmarkIndex = Math.max(0, parseInt(bookmarkIndex, 10) || 0);
			clickedIndex = Math.max(0, parseInt(clickedIndex, 10) || 0);

			if (config.usePagination) {
				const page = Math.ceil((parseInt(bookmarkIndex, 10) + 1) / config.topicsPerPage);
				if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
					pagination.loadPage(page, function () {
						handleBack.scrollToTopic(bookmarkIndex, clickedIndex);
					});
				} else {
					handleBack.scrollToTopic(bookmarkIndex, clickedIndex);
				}
			} else {
				if (bookmarkIndex === 0) {
					handleBack.scrollToTopic(bookmarkIndex, clickedIndex);
					return;
				}

				$(elements.get('container')).empty();
				loadTopicsMethod(Math.max(0, bookmarkIndex - 1) + 1, function () {
					handleBack.scrollToTopic(bookmarkIndex, clickedIndex);
				});
			}
		}
	}

	handleBack.highlightTopic = function (topicIndex) {
		const highlight = components.get('category/topic', 'index', topicIndex);

		if (highlight.length && !highlight.hasClass('highlight')) {
			highlight.addClass('highlight');
			setTimeout(function () {
				highlight.removeClass('highlight');
			}, 5000);
		}
	};

	handleBack.scrollToTopic = function (bookmarkIndex, clickedIndex) {
		if (!utils.isNumber(bookmarkIndex)) {
			return;
		}

		const scrollTo = components.get('category/topic', 'index', bookmarkIndex);

		if (scrollTo.length) {
			const offset = storage.getItem('category:bookmark:offset');
			storage.removeItem('category:bookmark:offset');
			$(window).scrollTop(scrollTo.offset().top - offset);
			handleBack.highlightTopic(clickedIndex);
			navigator.update();
		}
	};

	return handleBack;
});
