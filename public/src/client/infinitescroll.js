'use strict';

/* globals define, socket, ajaxify, templates, app */

define('forum/infinitescroll', ['translator'], function(translator) {

	var scroll = {};
	var callback;
	var previousScrollTop = 0;
	var loadingMore	= false;
	var container;

	scroll.init = function(el, cb) {
		if (typeof el === 'function') {
			callback = el;
			container = $(document);
		} else {
			callback = cb;
			container = el || $(document);
		}

		$(window).off('scroll', onScroll).on('scroll', onScroll);
	};

	function onScroll() {
		if (loadingMore) {
			return;
		}
		var currentScrollTop = $(window).scrollTop();
		var wh = $(window).height();
		var viewportHeight = container.height() - wh;
		var offsetTop = container.offset() ? container.offset().top : 0;
		var scrollPercent = 100 * (currentScrollTop - offsetTop) / (viewportHeight <= 0 ? wh : viewportHeight);

		var top = 20, bottom = 80;

		var direction = currentScrollTop > previousScrollTop ? 1 : -1;

		if (scrollPercent < top && currentScrollTop < previousScrollTop) {
			callback(direction);
		} else if (scrollPercent > bottom && currentScrollTop > previousScrollTop) {
			callback(direction);
		} else if (scrollPercent < 0 && direction > 0 && viewportHeight < 0) {
			callback(direction);
		}

		previousScrollTop = currentScrollTop;
	}

	scroll.loadMore = function(method, data, callback) {
		if (loadingMore) {
			return;
		}
		loadingMore = true;
		socket.emit(method, data, function(err, data) {
			if (err) {
				loadingMore = false;
				return app.alertError(err.message);
			}
			callback(data, function() {
				loadingMore = false;
			});
		});
	};

	scroll.removeExtra = function(els, direction, count) {
		if (els.length <= count) {
			return;
		}

		var removeCount = els.length - count;
		if (direction > 0) {
			var height = $(document).height(),
				scrollTop = $(window).scrollTop();

			els.slice(0, removeCount).remove();

			$(window).scrollTop(scrollTop + ($(document).height() - height));
		} else {
			els.slice(els.length - removeCount).remove();
		}
	};

	return scroll;
});