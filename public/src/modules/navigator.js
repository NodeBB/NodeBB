
'use strict';

/* globals app, define, ajaxify, utils, config */


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

		$(window).on('scroll', navigator.update);

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
		navigator.update();
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

	navigator.hide = function() {
		toggle(false);
	};

	function toggle(flag) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (flag && (!path.startsWith('topic') && !path.startsWith('category'))) {
			return;
		}

		$('.pagination-block').toggleClass('invisible', !flag);
	}

	navigator.update = function() {
		toggle(!!count);

		var topIndex = 0;
		var bottomIndex = 0;
		$(navigator.selector).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				if (!topIndex) {
					topIndex = parseInt(el.attr('data-index'), 10) + 1;
				} else {
					bottomIndex = parseInt(el.attr('data-index'), 10) + 1;
				}
			} else if (topIndex && bottomIndex) {
				return false;
			}
		});

		if (topIndex && !bottomIndex) {
			bottomIndex = topIndex;
		}

		if (typeof navigator.callback === 'function' && topIndex && bottomIndex) {
			index = navigator.callback(topIndex, bottomIndex, count);
			navigator.updateTextAndProgressBar();
		}
	};

	navigator.updateTextAndProgressBar = function() {
		index = index > count ? count : index;

		$('#pagination').translateHtml('[[global:pagination.out_of, ' + index + ', ' + count + ']]');
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

	function elementInView(el) {
		var scrollTop = $(window).scrollTop() + $('#header-menu').height();
		var scrollBottom = scrollTop + $(window).height();

		var elTop = el.offset().top;
		var elBottom = elTop + Math.floor(el.height());
		return (elTop >= scrollTop && elBottom <= scrollBottom) || (elTop <= scrollTop && elBottom >= scrollTop);
	}

	navigator.scrollToPost = function(postIndex, highlight, duration, offset) {
		if (!utils.isNumber(postIndex) || !components.get('topic').length) {
			return;
		}

		offset = offset || 0;
		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;

		if (components.get('post/anchor', postIndex).length) {
			return scrollToPid(postIndex, highlight, duration, offset);
		}

		if (config.usePagination) {

			var page = Math.max(1, Math.ceil(postIndex / config.postsPerPage));

			if(parseInt(page, 10) !== pagination.currentPage) {
				pagination.loadPage(page, function() {
					scrollToPid(postIndex, highlight, duration, offset);
				});
			} else {
				scrollToPid(postIndex, highlight, duration, offset);
			}
		} else {
			navigator.scrollActive = false;
			postIndex = parseInt(postIndex, 10) + 1;
			ajaxify.go(generateUrl(postIndex), undefined, true);
		}
	};

	function scrollToPid(postIndex, highlight, duration, offset) {
		var scrollTo = components.get('post/anchor', postIndex);

		if (!scrollTo.length) {
			navigator.scrollActive = false;
			return;
		}

		var done = false;
		function animateScroll() {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + 'px'
			}, duration, function() {
				if (done) {
					return;
				}
				done = true;

				navigator.scrollActive = false;
				navigator.update();
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
				}, 3000);
			}
		}

		if (components.get('topic').length) {
			animateScroll();
		}
	}


	return navigator;
});
