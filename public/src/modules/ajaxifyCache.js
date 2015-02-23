'use strict';
/* globals define, app, ajaxify */

define('ajaxifyCache', function() {
	var Cache = {
		url: undefined,
		DOM: undefined,
		tempDOM: undefined
	};

	Cache.set = function() {
		Cache.DOM = $('#content > *').detach();
	};

	Cache.get = function(url, callback) {
		if (url === Cache.url && ajaxify.isPopState) {
			// Swap DOM elements
			// setTimeout(function() {
				Cache.tempDOM = $('#content > *').detach();
				$('#content').append(Cache.DOM);
				Cache.DOM = Cache.tempDOM;
			// }, 100);	// 100ms for realism! :sunglasses:

			// Set the values that normally get set on ajaxify
			Cache.url = ajaxify.currentPage;
			ajaxify.currentPage = url;

			if (typeof callback === 'function') { callback(); }

			return true;
		} else {
			return false;
		}
	};

	return Cache;
});