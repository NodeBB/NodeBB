'use strict';

/* globals define */

define(function() {

	var module = {};

	module.addShareHandlers = function(name) {

		var baseUrl = window.location.protocol + '//' + window.location.host;

		function openShare(url, hash, width, height) {
			window.open(url + encodeURIComponent(baseUrl + window.location.pathname + hash), '_blank', 'width=' + width + ',height=' + height + ',scrollbars=no,status=no');
			return false;
		}

		$('#content').off('shown.bs.dropdown', '.share-dropdown').on('shown.bs.dropdown', '.share-dropdown', function() {

			var postLink = $(this).find('.post-link');
			postLink.val(baseUrl + window.location.pathname + getPostHash($(this)));

			// without the setTimeout can't select the text in the input
			setTimeout(function() {
				postLink.putCursorAtEnd().select();
			}, 50);
		});

		addHandler('.post-link', function(e) {
			e.preventDefault();
			return false;
		});

		addHandler('.twitter-share', function () {
			return openShare('https://twitter.com/intent/tweet?text=' + name + '&url=', getPostHash($(this)), 550, 420);
		});

		addHandler('.facebook-share', function () {
			return openShare('https://www.facebook.com/sharer/sharer.php?u=', getPostHash($(this)), 626, 436);
		});

		addHandler('.google-share', function () {
			return openShare('https://plus.google.com/share?url=', getPostHash($(this)), 500, 570);
		});
	};

	function addHandler(selector, callback) {
		$('#content').off('click', selector).on('click', selector, callback);
	}

	function getPostHash(clickedElement) {
		var pid = clickedElement.parents('.post-row').attr('data-pid');
		if (pid) {
			return '#' + pid;
		}
		return '';
	}

	return module;
});
