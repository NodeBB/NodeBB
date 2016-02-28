'use strict';

/* globals define */

define('share', function() {

	var module = {};

	module.addShareHandlers = function(name) {

		var baseUrl = window.location.protocol + '//' + window.location.host;

		function openShare(url, urlToPost, width, height) {
			window.open(url + encodeURIComponent(baseUrl + urlToPost), '_blank', 'width=' + width + ',height=' + height + ',scrollbars=no,status=no');
			return false;
		}

		$('#content').off('shown.bs.dropdown', '.share-dropdown').on('shown.bs.dropdown', '.share-dropdown', function() {

			var postLink = $(this).find('.post-link');
			postLink.val(baseUrl + getPostUrl($(this)));

			// without the setTimeout can't select the text in the input
			setTimeout(function() {
				postLink.putCursorAtEnd().select();
			}, 50);
		});

		addHandler('.post-link', function(e) {
			e.preventDefault();
			return false;
		});

		addHandler('[component="share/twitter"]', function () {
			return openShare('https://twitter.com/intent/tweet?text=' + encodeURIComponent(name) + '&url=', getPostUrl($(this)), 550, 420);
		});

		addHandler('[component="share/facebook"]', function () {
			return openShare('https://www.facebook.com/sharer/sharer.php?u=', getPostUrl($(this)), 626, 436);
		});

		addHandler('[component="share/google"]', function () {
			return openShare('https://plus.google.com/share?url=', getPostUrl($(this)), 500, 570);
		});

		$(window).trigger('action:share.addHandlers', {openShare: openShare});
	};

	function addHandler(selector, callback) {
		$('#content').off('click', selector).on('click', selector, callback);
	}

	function getPostUrl(clickedElement) {
		var parts = window.location.pathname.split('/');
		var postIndex = parseInt(clickedElement.parents('[data-index]').attr('data-index'), 10);
		return '/' + parts[1] + '/' + parts[2] + (parts[3] ? '/' + parts[3] : '') + (postIndex ? '/' + (postIndex + 1) : '');
	}

	return module;
});
