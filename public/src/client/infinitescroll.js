'use strict';

/* globals define, socket, ajaxify, templates, app */

define('forum/infinitescroll', ['translator'], function(translator) {

	var scroll = {};
	var callback;
	var previousScrollTop = 0;
	var loadingMore	= false;
	var topOffset = 0;

	scroll.init = function(cb, _topOffest) {
		callback = cb;
		topOffset = _topOffest || 0;
		$(window).off('scroll', onScroll).on('scroll', onScroll);
	};

	function onScroll() {
		var currentScrollTop = $(window).scrollTop();
		var scrollPercent = 100 * currentScrollTop / ($(document).height() - $(window).height());

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