
'use strict';

/* globals app, define, ajaxify, utils, translator, config */


define('navigator', ['forum/pagination'], function(pagination) {

	var navigator = {};
	var index = 1;
	var count = 0;
	navigator.scrollActive = false;

	navigator.init = function(selector, count, callback, toTop, toBottom) {

		navigator.selector = selector;
		navigator.callback = callback;
		toTop = toTop || function() {};
		toBottom = toBottom || function() {};

		$(window).on('scroll', navigator.update);

		$('.pagination-block .dropdown-menu').off('click').on('click', function(e) {
			e.stopPropagation();
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
				var url = generateUrl(input.val());
				input.val('');
				$('.pagination-block .dropdown-toggle').trigger('click');
				ajaxify.go(url);
			}
		});

		navigator.setCount(count);
		navigator.update();
	};

	function generateUrl(index) {
		var parts = window.location.pathname.split('/');
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
		$('.pagination-block').toggleClass('hidden', !flag);
	}

	navigator.update = function() {
		toggle(!!count);

		$($(navigator.selector).get().reverse()).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				index = parseInt(el.attr('data-index'), 10) + 1;

				navigator.updateTextAndProgressBar();

				if (typeof navigator.callback === 'function') {
					navigator.callback(el);
				}

				return false;
			}
		});
	};

	navigator.updateTextAndProgressBar = function() {
		index = index > count ? count : index;

		$('#pagination').translateHtml('[[global:pagination.out_of, ' + index + ', ' + count + ']]');
		$('.pagination-block .progress-bar').width((index / count * 100) + '%');
	};

	navigator.scrollUp = function () {
		$('body,html').animate({
			scrollTop: $('body').scrollTop() - $(window).height()
		});
	};

	navigator.scrollDown = function () {
		$('body,html').animate({
			scrollTop: $('body').scrollTop() + $(window).height()
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
		if (!utils.isNumber(postIndex)) {
			return;
		}

		offset = offset || 0;
		duration = duration !== undefined ? duration : 400;
		navigator.scrollActive = true;

		if($('#post_anchor_' + postIndex).length) {
			return scrollToPid(postIndex, highlight, duration, offset);
		}

		if(config.usePagination) {
			if (window.location.search.indexOf('page') !== -1) {
				navigator.update();
				return;
			}

			var page = Math.ceil((postIndex + 1) / config.postsPerPage);

			if(parseInt(page, 10) !== pagination.currentPage) {
				pagination.loadPage(page, function() {
					scrollToPid(postIndex, highlight, duration, offset);
				});
			} else {
				scrollToPid(postIndex, highlight, duration, offset);
			}
		}
	};

	function scrollToPid(postIndex, highlight, duration, offset) {
		var scrollTo = $('#post_anchor_' + postIndex);

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
				scrollTo.parent().find('.topic-item').addClass('highlight');
				setTimeout(function() {
					scrollTo.parent().find('.topic-item').removeClass('highlight');
				}, 3000);
			}
		}

		if ($('#post-container').length && scrollTo.length) {
			animateScroll();
		}
	}


	return navigator;
});
