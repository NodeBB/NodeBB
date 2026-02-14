'use strict';


define('share', ['hooks'], function (hooks) {
	const module = {};
	const baseUrl = window.location.protocol + '//' + window.location.host;

	module.addShareHandlers = function (name) {
		function openShare(url, urlToPost, width, height) {
			window.open(url, '_blank', 'width=' + width + ',height=' + height + ',scrollbars=no,status=no');
			hooks.fire('action:share.open', {
				url: url,
				urlToPost: urlToPost,
			});
			return false;
		}

		$('#content').off('shown.bs.dropdown', '.share-dropdown').on('shown.bs.dropdown', '.share-dropdown', function () {
			const postLink = $(this).find('.post-link');
			postLink.val(baseUrl + getPostUrl($(this)));

			// without the setTimeout can't select the text in the input
			setTimeout(function () {
				postLink.putCursorAtEnd().select();
			}, 50);
		});

		addHandler('.post-link', function (e) {
			e.preventDefault();
			return false;
		});

		addHandler('[component="share/twitter"]', function () {
			const postUrl = getPostUrl($(this));
			const twitter_url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(postUrl)}`;
			return openShare(twitter_url, postUrl, 550, 420);
		});

		addHandler('[component="share/facebook"]', function () {
			const postUrl = getPostUrl($(this));
			const facebook_url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
			return openShare(facebook_url, postUrl, 626, 436);
		});

		addHandler('[component="share/whatsapp"]', function () {
			const postUrl = getPostUrl($(this));
			const message = encodeURIComponent(name) + ' - ' + encodeURIComponent(postUrl);
			const whatsapp_url = config.useragent.isMobile ?
				`whatsapp://send?text=${message}` :
				`https://wa.me/?text=${message}`;
			return openShare(whatsapp_url, postUrl, 626, 436);
		});

		addHandler('[component="share/telegram"]', function () {
			const postUrl = getPostUrl($(this));
			const telegram_url = `https://t.me/share/url?text=${encodeURIComponent(name)}&url=${encodeURIComponent(postUrl)}`;
			return openShare(telegram_url, postUrl, 626, 436);
		});

		addHandler('[component="share/linkedin"]', function () {
			const postUrl = getPostUrl($(this));
			const linkedin_url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
			return openShare(linkedin_url, postUrl, 626, 436);
		});

		hooks.fire('action:share.addHandlers', { openShare: openShare });
	};

	function addHandler(selector, callback) {
		$('#content').off('click', selector).on('click', selector, callback);
	}

	function getPostUrl(clickedElement) {
		const pid = parseInt(clickedElement.parents('[data-pid]').attr('data-pid'), 10);
		const path = '/post' + (pid ? '/' + (pid) : '');
		return baseUrl + config.relative_path + path;
	}

	return module;
});
