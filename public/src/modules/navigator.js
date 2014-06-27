
'use strict';

/* globals app, define, ajaxify, utils, translator */


define('navigator', function() {

	var navigator = {};
	var index = 1;
	var count = 0;

	navigator.init = function(selector, count, callback) {

		navigator.selector = selector;
		navigator.callback = callback;

		$(window).on('scroll', navigator.update);

		$('.pagination-block .dropdown-menu').off('click').on('click', function(e) {
			e.stopPropagation();
		});

		$('.pagination-block .pageup').off('click').on('click', function() {
			navigator.scrollToTop();
		});

		$('.pagination-block .pagedown').off('click').on('click', function() {
			navigator.scrollToBottom();
		});

		$('.pagination-block .pagetop').off('click').on('click', function() {
			ajaxify.go(generateUrl());
		});

		$('.pagination-block .pagebottom').off('click').on('click', function() {
			ajaxify.go(generateUrl(count));
		});

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
		translator.translate('[[global:pagination.out_of, ' + index + ', ' + count + ']]', function(translated) {
			$('#pagination').html(translated);
		});

		$('.pagination-block .progress-bar').width((index / count * 100) + '%');
	};

	navigator.scrollToTop = function () {
		$('body,html').animate({
			scrollTop: 0
		});
	};

	navigator.scrollToBottom = function () {
		$('body,html').animate({
			scrollTop: $('html').height() - 100
		});
	};

	function elementInView(el) {
		var scrollTop = $(window).scrollTop() + $('#header-menu').height();
		var scrollBottom = scrollTop + $(window).height();

		var elTop = el.offset().top;
		var elBottom = elTop + Math.floor(el.height());
		return (elTop >= scrollTop && elBottom <= scrollBottom) || (elTop <= scrollTop && elBottom >= scrollTop);
	}

	return navigator;
});
