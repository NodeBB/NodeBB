'use strict';

define('navigator', ['forum/pagination', 'components'], function (pagination, components) {
	var navigator = {};
	var index = 1;
	var count = 0;
	var navigatorUpdateTimeoutId;

	navigator.scrollActive = false;

	$(window).on('action:ajaxify.start', function () {
		$(window).off('keydown', onKeyDown);
	});

	navigator.init = function (selector, count, toTop, toBottom, callback, calculateIndex) {
		index = 1;
		navigator.selector = selector;
		navigator.callback = callback;
		navigator.toTop = toTop || function () {};
		navigator.toBottom = toBottom || function () {};

		$(window).off('scroll', navigator.delayedUpdate).on('scroll', navigator.delayedUpdate);

		$('.pagination-block .dropdown-menu').off('click').on('click', function (e) {
			e.stopPropagation();
		});

		$('.pagination-block').off('shown.bs.dropdown', '.dropdown').on('shown.bs.dropdown', '.dropdown', function () {
			setTimeout(function () {
				$('.pagination-block input').focus();
			}, 100);
		});

		$('.pagination-block .pageup').off('click').on('click', navigator.scrollUp);
		$('.pagination-block .pagedown').off('click').on('click', navigator.scrollDown);
		$('.pagination-block .pagetop').off('click').on('click', navigator.toTop);
		$('.pagination-block .pagebottom').off('click').on('click', navigator.toBottom);

		$('.pagination-block input').on('keydown', function (e) {
			if (e.which === 13) {
				var input = $(this);
				if (!utils.isNumber(input.val())) {
					input.val('');
					return;
				}

				var index = parseInt(input.val(), 10);
				if (typeof calculateIndex === 'function') {
					index = calculateIndex(index, count);
				}

				var url = generateUrl(index);
				input.val('');
				$('.pagination-block .dropdown-toggle').trigger('click');
				ajaxify.go(url);
			}
		});

		handleKeys();

		navigator.setCount(count);
		navigator.update(0);
	};

	function handleKeys() {
		if (!config.usePagination) {
			$(window).off('keydown', onKeyDown).on('keydown', onKeyDown);
		}
	}

	function onKeyDown(ev) {
		if (ev.target.nodeName === 'BODY') {
			if (ev.shiftKey || ev.ctrlKey || ev.altKey) {
				return;
			}
			if (ev.which === 36 && navigator.toTop) { // home key
				navigator.toTop();
				return false;
			} else if (ev.which === 35 && navigator.toBottom) { // end key
				navigator.toBottom();
				return false;
			}
		}
	}

	function generateUrl(index) {
		var pathname = window.location.pathname.replace(config.relative_path, '');
		var parts = pathname.split('/');
		return parts[1] + '/' + parts[2] + '/' + parts[3] + (index ? '/' + index : '');
	}

	navigator.setCount = function (value) {
		count = parseInt(value, 10);
		navigator.updateTextAndProgressBar();
	};

	navigator.show = function () {
		toggle(true);
	};

	navigator.disable = function () {
		count = 0;
		index = 1;
		navigator.callback = null;
		navigator.selector = null;
		$(window).off('scroll', navigator.delayedUpdate);

		toggle(false);
	};

	function toggle(flag) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (flag && (!path.startsWith('topic') && !path.startsWith('category'))) {
			return;
		}

		$('.pagination-block').toggleClass('ready', flag);
	}

	navigator.delayedUpdate = function () {
		if (!navigatorUpdateTimeoutId) {
			navigatorUpdateTimeoutId = setTimeout(function () {
				navigator.update();
				navigatorUpdateTimeoutId = undefined;
			}, 100);
		}
	};

	navigator.update = function (threshold) {
		/*
			The "threshold" is defined as the distance from the top of the page to
			a spot where a user is expecting to begin reading.
		*/
		threshold = typeof threshold === 'number' ? threshold : undefined;

		var els = $(navigator.selector);
		if (els.length) {
			index = parseInt(els.first().attr('data-index'), 10) + 1;
		}

		var scrollTop = $(window).scrollTop();
		var windowHeight = $(window).height();
		var documentHeight = $(document).height();
		var middleOfViewport = scrollTop + (windowHeight / 2);
		var previousDistance = Number.MAX_VALUE;
		els.each(function () {
			var distanceToMiddle = Math.abs(middleOfViewport - $(this).offset().top);

			if (distanceToMiddle > previousDistance) {
				return false;
			}

			if (distanceToMiddle < previousDistance) {
				index = parseInt($(this).attr('data-index'), 10) + 1;
				previousDistance = distanceToMiddle;
			}
		});

		var atTop = scrollTop === 0 && parseInt(els.first().attr('data-index'), 10) === 0;
		var nearBottom = scrollTop + windowHeight > documentHeight - 100 && parseInt(els.last().attr('data-index'), 10) === count - 1;

		if (atTop) {
			index = 1;
		} else if (nearBottom) {
			index = count;
		}

		// If a threshold is undefined, try to determine one based on new index
		if (threshold === undefined && ajaxify.data.template.topic === true) {
			if (atTop) {
				threshold = 0;
			} else {
				var anchorEl = components.get('post/anchor', index - 1);
				if (anchorEl.length) {
					var anchorRect = anchorEl.get(0).getBoundingClientRect();
					threshold = anchorRect.top;
				}
			}
		}

		if (typeof navigator.callback === 'function') {
			navigator.callback(index, count, threshold);
		}

		navigator.updateTextAndProgressBar();
		toggle(!!count);
	};

	navigator.updateTextAndProgressBar = function () {
		if (!utils.isNumber(index)) {
			return;
		}
		index = index > count ? count : index;
		var relIndex = getRelativeIndex();
		$('.pagination-block .pagination-text').translateHtml('[[global:pagination.out_of, ' + relIndex + ', ' + count + ']]');
		var fraction = (relIndex - 1) / (count - 1 || 1);
		$('.pagination-block meter').val(fraction);
		$('.pagination-block .progress-bar').width((fraction * 100) + '%');
	};

	function getRelativeIndex() {
		var relIndex = index;
		if (relIndex === 1) {
			return 1;
		}
		if (ajaxify.data.template.topic) {
			if (config.topicPostSort === 'most_votes' || config.topicPostSort === 'newest_to_oldest') {
				relIndex = ajaxify.data.postcount - index + 2;
			}
		}
		return relIndex;
	}

	navigator.scrollUp = function () {
		var $window = $(window);

		if (config.usePagination) {
			var atTop = $window.scrollTop() <= 0;
			if (atTop) {
				return pagination.previousPage(function () {
					$('body,html').scrollTop($(document).height() - $window.height());
				});
			}
		}
		$('body,html').animate({
			scrollTop: $window.scrollTop() - $window.height(),
		});
	};

	navigator.scrollDown = function () {
		var $window = $(window);

		if (config.usePagination) {
			var atBottom = $window.scrollTop() >= $(document).height() - $window.height();
			if (atBottom) {
				return pagination.nextPage();
			}
		}
		$('body,html').animate({
			scrollTop: $window.scrollTop() + $window.height(),
		});
	};

	navigator.scrollTop = function (index) {
		if ($(navigator.selector + '[data-index="' + index + '"]').length) {
			navigator.scrollToIndex(index, true);
		} else {
			ajaxify.go(generateUrl());
		}
	};

	navigator.scrollBottom = function (index) {
		if (parseInt(index, 10) < 0) {
			return;
		}

		if ($(navigator.selector + '[data-index="' + index + '"]').length) {
			navigator.scrollToIndex(index, true);
		} else {
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
		}
	};

	navigator.scrollToIndex = function (index, highlight, duration) {
		var inTopic = !!components.get('topic').length;
		var inCategory = !!components.get('category').length;

		if (!utils.isNumber(index) || (!inTopic && !inCategory)) {
			return;
		}

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;

		// if in topic and item already on page
		if (inTopic && components.get('post/anchor', index).length) {
			return navigator.scrollToPostIndex(index, highlight, duration);
		}

		// if in category and item alreay on page
		if (inCategory && $('[component="category/topic"][data-index="' + index + '"]').length) {
			return navigator.scrollToTopicIndex(index, highlight, duration);
		}

		if (!config.usePagination) {
			navigator.scrollActive = false;
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
			return;
		}

		var scrollMethod = inTopic ? navigator.scrollToPostIndex : navigator.scrollToTopicIndex;
		if (inTopic) {
			if (config.topicPostSort === 'most_votes' || config.topicPostSort === 'newest_to_oldest') {
				index = ajaxify.data.postcount - index;
			}
		} else if (inCategory) {
			if (config.categoryTopicSort === 'most_posts' || config.categoryTopicSort === 'oldest_to_newest') {
				index = ajaxify.data.topic_count - index;
			}
		}

		var page = Math.max(1, Math.ceil((index + 1) / config.postsPerPage));

		if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
			pagination.loadPage(page, function () {
				scrollMethod(index, highlight, duration);
			});
		} else {
			scrollMethod(index, highlight, duration);
		}
	};

	navigator.scrollToPostIndex = function (postIndex, highlight, duration) {
		var scrollTo = components.get('post', 'index', postIndex);
		navigator.scrollToElement(scrollTo, highlight, duration);
	};

	navigator.scrollToTopicIndex = function (topicIndex, highlight, duration) {
		var scrollTo = $('[component="category/topic"][data-index="' + topicIndex + '"]');
		navigator.scrollToElement(scrollTo, highlight, duration);
	};

	navigator.scrollToElement = function (scrollTo, highlight, duration) {
		if (!scrollTo.length) {
			navigator.scrollActive = false;
			return;
		}
		var postHeight = scrollTo.height();
		var viewportHeight = $(window).height();
		var navbarHeight = components.get('navbar').height();

		// Temporarily disable navigator update on scroll
		$(window).off('scroll', navigator.update);

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;
		var done = false;

		function animateScroll() {
			var scrollTop = 0;
			if (postHeight < viewportHeight) {
				scrollTop = (scrollTo.offset().top - (viewportHeight / 2) + (postHeight / 2));
			} else {
				scrollTop = scrollTo.offset().top - navbarHeight;
			}

			$('html, body').animate({
				scrollTop: scrollTop + 'px',
			}, duration, function () {
				if (done) {
					// Re-enable onScroll behaviour
					$(window).on('scroll', navigator.update);
					var scrollToRect = scrollTo.get(0).getBoundingClientRect();
					navigator.update(scrollToRect.top);
					return;
				}
				done = true;

				navigator.scrollActive = false;
				highlightPost();
				$('body').scrollTop($('body').scrollTop() - 1);
				$('html').scrollTop($('html').scrollTop() - 1);
			});
		}

		function highlightPost() {
			if (highlight) {
				scrollTo.addClass('highlight');
				setTimeout(function () {
					scrollTo.removeClass('highlight');
				}, 10000);
			}
		}

		animateScroll();
	};

	return navigator;
});
