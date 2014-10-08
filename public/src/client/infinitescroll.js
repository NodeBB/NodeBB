'use strict';

/* globals define, socket, ajaxify, translator, templates, app */

define('forum/infinitescroll', function() {

	var scroll = {};
	var callback;
	var previousScrollTop = 0;
	var loadingMore	= false;
	var topOffset = 0;

	scroll.init = function(cb, _topOffest) {
		callback = cb;
		topOffset = _topOffest || 0;
		$(window).off('scroll', onScroll).on('scroll', onScroll);

		// if ($(document).height() === $(window).height()) {
		// 	callback(1);
		// }
	};

	function onScroll() {
		var originalPostEl = $('li[data-index="0"]'),
			top = $(window).height() * 0.15 + topOffset + (originalPostEl ? originalPostEl.outerHeight() : 0),
			bottom = ($(document).height() - $(window).height()) * 0.85,
			currentScrollTop = $(window).scrollTop();

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
				loadingMore = false;
				return app.alertError(err.message);
			}
			callback(data, function() {
				loadingMore = false;
			});
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

	scroll.calculateAfter = function(direction, selector, count, reverse, callback) {
		var after = 0,
			offset = 0,
			el = direction > 0 ? $(selector).last() : $(selector).first(),
			increment;

		count = reverse ? -count : count;
		increment = reverse ? -1 : 1;

		if (direction > 0) {
			after = parseInt(el.attr('data-index'), 10) + increment;
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