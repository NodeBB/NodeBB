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
			cb = el;
			el = null;
		}
		callback = cb;
		container = el || $(document);
		$(window).off('scroll', onScroll).on('scroll', onScroll);
	};

	function onScroll() {
		var currentScrollTop = $(window).scrollTop();
		var wh = $(window).height();
		var offsetTop = container.offset() ? container.offset().top : 0;
		var scrollPercent = 100 * (currentScrollTop - offsetTop) / Math.max(wh, (container.height() - wh));

		var top = 20, bottom = 80;

		if (scrollPercent < top && currentScrollTop < previousScrollTop) {
			callback(-1);
		} else if (scrollPercent > bottom && currentScrollTop > previousScrollTop) {
			callback(1);
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

	scroll.parseAndTranslate = function(template, blockName, data, callback) {
		templates.parse(template, blockName, data, function(html) {
			translator.translate(html, function(translatedHTML) {
				callback($(translatedHTML));
			});
		});
	};

	return scroll;
});