'use strict';


define('forum/infinitescroll', ['hooks'], function (hooks) {
	const scroll = {};
	let callback;
	let previousScrollTop = 0;
	let loadingMore = false;
	let container;
	let scrollTimeout = 0;

	scroll.init = function (el, cb) {
		const $body = $('body');
		if (typeof el === 'function') {
			callback = el;
			container = $body;
		} else {
			callback = cb;
			container = el || $body;
		}
		previousScrollTop = $(window).scrollTop();
		$(window).off('scroll', startScrollTimeout).on('scroll', startScrollTimeout);

		if ($body.height() <= $(window).height()) {
			callback(1);
		}
	};

	function startScrollTimeout() {
		if (scrollTimeout) {
			clearTimeout(scrollTimeout);
		}
		scrollTimeout = setTimeout(function () {
			scrollTimeout = 0;
			onScroll();
		}, 60);
	}

	function onScroll() {
		const bsEnv = utils.findBootstrapEnvironment();
		const mobileComposerOpen = (bsEnv === 'xs' || bsEnv === 'sm') && $('html').hasClass('composing');
		if (loadingMore || mobileComposerOpen) {
			return;
		}
		const currentScrollTop = $(window).scrollTop();
		const wh = $(window).height();
		const viewportHeight = container.height() - wh;
		const offsetTop = container.offset() ? container.offset().top : 0;
		const scrollPercent = 100 * (currentScrollTop - offsetTop) / (viewportHeight <= 0 ? wh : viewportHeight);

		const top = 15;
		const bottom = 85;
		const direction = currentScrollTop > previousScrollTop ? 1 : -1;

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

		const hookData = { method: method, data: data };
		hooks.fire('action:infinitescroll.loadmore', hookData);

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

	scroll.loadMoreXhr = function (data, callback) {
		if (loadingMore) {
			return;
		}
		loadingMore = true;
		const url = config.relative_path + '/api' + location.pathname.replace(new RegExp('^' + config.relative_path), '');
		const hookData = { url: url, data: data };
		hooks.fire('action:infinitescroll.loadmore.xhr', hookData);

		$.get(url, data, function (data) {
			callback(data, function () {
				loadingMore = false;
			});
		}).fail(function (jqXHR) {
			loadingMore = false;
			app.alertError(String(jqXHR.responseJSON || jqXHR.statusText));
		});
	};

	scroll.removeExtra = function (els, direction, count) {
		if (els.length <= count) {
			return;
		}

		const removeCount = els.length - count;
		if (direction > 0) {
			const height = $(document).height();
			const scrollTop = $(window).scrollTop();

			els.slice(0, removeCount).remove();

			$(window).scrollTop(scrollTop + ($(document).height() - height));
		} else {
			els.slice(els.length - removeCount).remove();
		}
	};

	return scroll;
});
