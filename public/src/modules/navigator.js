
'use strict';

/* globals app, define, ajaxify */


define(function() {

	var navigator = {};
	var index = 1;
	var count = 0;

	navigator.init = function(selector, count, callback) {

		navigator.selector = selector;
		navigator.callback = callback;

		$(window).on('scroll', navigator.update);

		$('.pagination-block a').off('click').on('click', function() {
			return false;
		});

		$('.pagination-block i:first').off('click').on('click', function() {
			navigator.scrollToTop();
		});

		$('.pagination-block i:last').off('click').on('click', function() {
			navigator.scrollToBottom();
		});

		navigator.setCount(count);
		navigator.update();
		navigator.show();
	};

	navigator.setCount = function(value) {
		count = value;
		navigator.updateTextAndProgressBar();
	};

	navigator.show = function() {
		$('.pagination-block').removeClass('hidden');
	};

	navigator.hide = function() {
		$('.pagination-block').addClass('hidden');
	};

	navigator.update = function() {
		$($(navigator.selector).get().reverse()).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				index = parseInt(el.attr('data-index'), 10) + 1;
				if(index > count) {
					index = count;
				}

				navigator.updateTextAndProgressBar();

				if (typeof navigator.callback === 'function') {
					navigator.callback(el);
				}

				return false;
			}
		});
	};

	navigator.updateTextAndProgressBar = function() {
		$('#pagination').html(index + ' out of ' + count);
		$('.progress-bar').width((index / count * 100) + '%');
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