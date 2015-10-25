'use strict';
/*global define, utils, ajaxify, bootbox*/

define('forum/pagination', function() {
	var pagination = {};

	pagination.init = function() {
		$('body').on('click', '.pagination .select-page', function(e) {
			e.preventDefault();
			bootbox.prompt('Enter page number:', function(pageNum) {
				pagination.loadPage(pageNum);
			});
		});
	};

	pagination.loadPage = function(page, callback) {
		callback = callback || function() {};
		page = parseInt(page, 10);
		if (!utils.isNumber(page) || page < 1 || page > ajaxify.data.pagination.pageCount) {
			return;
		}

		var query = utils.params();
		query.page = page;

		var url = window.location.pathname + '?' + $.param(query);
		ajaxify.go(url, callback);
	};

	return pagination;
});
