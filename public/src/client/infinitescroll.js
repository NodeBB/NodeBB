'use strict';


define('forum/infinitescroll', function () {
	var scroll = {};
	var callback;
	var previousScrollTop = 0;
	var loadingMore	= false;
	var container;

	scroll.init = function (el, cb) {
		if (typeof el === 'function') {
			callback = el;
			container = $('body');
		} else {
			callback = cb;
			container = el || $('body');
		}
		previousScrollTop = $(window).scrollTop();
		$(window).off('scroll', onScroll).on('scroll', onScroll);
	};

	function onScroll() {
		var bsEnv = utils.findBootstrapEnvironment();
		var mobileComposerOpen = (bsEnv === 'xs' || bsEnv === 'sm') && $('html').hasClass('composing');
		if (loadingMore || mobileComposerOpen) {
			return;
		}
		var currentScrollTop = $(window).scrollTop();
		var wh = $(window).height();
		var viewportHeight = container.height() - wh;
		var offsetTop = container.offset() ? container.offset().top : 0;
		var scrollPercent = 100 * (currentScrollTop - offsetTop) / (viewportHeight <= 0 ? wh : viewportHeight);

		var top = 20;
		var bottom = 80;

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

	scroll.loadMore = function (method, data, callback) {
		if (loadingMore) {
			return;
		}
		loadingMore = true;

		var hookData = { method: method, data: data };
		$(window).trigger('action:infinitescroll.loadmore', hookData);

		socket.emit(hookData.method, hookData.data, function (err, data) {
			if (err) {
				loadingMore = false;
				return app.alertError(err.message);
			}
			callback(data, function () {
				loadingMore = false;
			});
		});
	};

	scroll.removeExtra = function (els, direction, count) {
		if (els.length <= count) {
			return;
		}

		var removeCount = els.length - count;
		if (direction > 0) {
			var height = $(document).height();
			var scrollTop = $(window).scrollTop();

			els.slice(0, removeCount).remove();

			$(window).scrollTop(scrollTop + ($(document).height() - height));
		} else {
			els.slice(els.length - removeCount).remove();
		}
	};

	return scroll;
});
