'use strict';

/* globals define, socket, ajaxify, translator, templates, app */

define('forum/infinitescroll', function() {

	var scroll = {};
	var callback;
	var previousScrollTop = 0;
	var loadingMore	= false;

	scroll.init = function(cb) {
		callback = cb;
		$(window).off('scroll', onScroll).on('scroll', onScroll);
	};

	function onScroll() {
		var top = $(window).height() * 0.1;
		var bottom = ($(document).height() - $(window).height()) * 0.9;
		var currentScrollTop = $(window).scrollTop();

		if(currentScrollTop < top && currentScrollTop < previousScrollTop) {
			callback(-1);
		} else if (currentScrollTop > bottom && currentScrollTop > previousScrollTop) {
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
				return app.alertError(err.message);
			}
			callback(data);
			loadingMore = false;
		});
	};

	scroll.parseAndTranslate = function(template, blockName, data, callback) {
		ajaxify.loadTemplate(template, function(templateHtml) {
			var html = templates.parse(templates.getBlock(templateHtml, blockName), data);

			translator.translate(html, function(translatedHTML) {
				callback($(translatedHTML));
			});
		});
	};

	scroll.calculateAfter = function(direction, selector, count, callback) {
		var after = 0,
			offset = 0,
			el = direction > 0 ? $(selector).last() : $(selector).first();

		if (direction > 0) {
			after = parseInt(el.attr('data-index'), 10) + 1;
		} else {
			after = parseInt(el.attr('data-index'), 10);
			if (isNaN(after)) {
				after = 0;
			}
			after -= count;
			if (after < 0) {
				after = 0;
			}
			if (el && el.offset()) {
				offset = el.offset().top - $('#header-menu').offset().top + $('#header-menu').height();
			}
		}

		callback(after, offset, el);
	};

	return scroll;
});