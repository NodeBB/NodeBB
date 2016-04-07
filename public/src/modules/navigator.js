
'use strict';

/* globals define, ajaxify, utils, config */


define('navigator', ['forum/pagination', 'components'], function(pagination, components) {

	var navigator = {};
	var index = 1;
	var count = 0;
	navigator.scrollActive = false;

	navigator.init = function(selector, count, toTop, toBottom, callback, calculateIndex) {
		index = 1;
		navigator.selector = selector;
		navigator.callback = callback;
		toTop = toTop || function() {};
		toBottom = toBottom || function() {};

		$(window).off('scroll', navigator.update).on('scroll', navigator.update);

		$('.pagination-block .dropdown-menu').off('click').on('click', function(e) {
			e.stopPropagation();
		});

		$('.pagination-block').off('shown.bs.dropdown', '.dropdown').on('shown.bs.dropdown', '.dropdown', function() {
			setTimeout(function() {
				$('.pagination-block input').focus();
			}, 100);
		});

		$('.pagination-block .pageup').off('click').on('click', navigator.scrollUp);
		$('.pagination-block .pagedown').off('click').on('click', navigator.scrollDown);
		$('.pagination-block .pagetop').off('click').on('click', toTop);
		$('.pagination-block .pagebottom').off('click').on('click', toBottom);

		$('.pagination-block input').on('keydown', function(e) {
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

		navigator.setCount(count);
	};

	function generateUrl(index) {
		var pathname = window.location.pathname.replace(config.relative_path, '');
		var parts = pathname.split('/');
		return parts[1] + '/' + parts[2] + '/' + parts[3] + (index ? '/' + index : '');
	}

	navigator.setCount = function(value) {
		count = parseInt(value, 10);
		navigator.updateTextAndProgressBar();
	};

	navigator.show = function() {
		toggle(true);
	};

	navigator.disable = function() {
		count = 0;
		index = 1;
		navigator.selector = navigator.callback = null;
		$(window).off('scroll', navigator.update);

		toggle(false);
	};

	function toggle(flag) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (flag && (!path.startsWith('topic') && !path.startsWith('category'))) {
			return;
		}

		$('.pagination-block').toggleClass('ready', flag);
	}

	navigator.update = function(threshold) {
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
		var middleOfViewport = scrollTop + windowHeight / 2;
		var previousDistance = Number.MAX_VALUE;
		els.each(function() {
			var distanceToMiddle = Math.abs(middleOfViewport - $(this).offset().top);

			if (distanceToMiddle > previousDistance) {
				return false;
			}

			if (distanceToMiddle < previousDistance) {
				index = parseInt($(this).attr('data-index'), 10) + 1;
				previousDistance = distanceToMiddle;
			}
		});

		var atTop = scrollTop === 0 && parseInt(els.first().attr('data-index'), 10) === 0,
			nearBottom = scrollTop + windowHeight > documentHeight - 100 && parseInt(els.last().attr('data-index'), 10) === count - 1;

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
				var anchorRect = anchorEl.get(0).getBoundingClientRect();
				threshold = anchorRect.top;
			}
		}

		if (typeof navigator.callback === 'function') {
			navigator.callback(index, count, threshold);
		}

		navigator.updateTextAndProgressBar();
		toggle(!!count);
	};

	navigator.updateTextAndProgressBar = function() {
		index = index > count ? count : index;

		$('.pagination-block .pagination-text').translateHtml('[[global:pagination.out_of, ' + index + ', ' + count + ']]');
		$('.pagination-block .progress-bar').width((index / count * 100) + '%');
	};

	navigator.scrollUp = function () {
		$('body,html').animate({
			scrollTop: $(window).scrollTop() - $(window).height()
		});
	};

	navigator.scrollDown = function () {
		$('body,html').animate({
			scrollTop: $(window).scrollTop() + $(window).height()
		});
	};

	navigator.scrollTop = function(index) {
		if ($('li[data-index="' + index + '"]').length) {
			navigator.scrollToPost(index, true);
		} else {
			ajaxify.go(generateUrl());
		}
	};

	navigator.scrollBottom = function(index) {
		if (parseInt(index, 10) < 0) {
			return;
		}
		if ($('li[data-index="' + index + '"]').length) {
			navigator.scrollToPost(index, true);
		} else {
			index = parseInt(index, 10) + 1;
			ajaxify.go(generateUrl(index));
		}
	};

	navigator.scrollToPost = function(postIndex, highlight, duration) {
		if (!utils.isNumber(postIndex) || !components.get('topic').length) {
			return;
		}

		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;

		if (components.get('post/anchor', postIndex).length) {
			return navigator.scrollToPostIndex(postIndex, highlight, duration);
		}

		if (config.usePagination) {
			var page = Math.max(1, Math.ceil(postIndex / config.postsPerPage));

			if (parseInt(page, 10) !== ajaxify.data.pagination.currentPage) {
				pagination.loadPage(page, function() {
					navigator.scrollToPostIndex(postIndex, highlight, duration);
				});
			} else {
				navigator.scrollToPostIndex(postIndex, highlight, duration);
			}
		} else {
			navigator.scrollActive = false;
			postIndex = parseInt(postIndex, 10) + 1;
			ajaxify.go(generateUrl(postIndex));
		}
	};

	navigator.scrollToPostIndex = function(postIndex, highlight, duration) {
		var scrollTo = components.get('post/anchor', postIndex),
			postEl = components.get('post', 'index', postIndex),
			postHeight = postEl.height(),
			viewportHeight = $(window).height(),
			navbarHeight = components.get('navbar').height();


		if (!scrollTo.length) {
			navigator.scrollActive = false;
			return;
		}

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
				scrollTop: scrollTop + 'px'
			}, duration, function() {
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
				scrollTo.parents('[component="post"]').addClass('highlight');
				setTimeout(function() {
					scrollTo.parents('[component="post"]').removeClass('highlight');
				}, 10000);
			}
		}

		if (components.get('topic').length) {
			animateScroll();
		} else {
			navigator.scrollActive = false;
		}
	};


	return navigator;
});
