'use strict';
/*global define, utils, ajaxify, bootbox*/

define('forum/pagination', function() {
	var pagination = {};

	pagination.currentPage = 0;
	pagination.pageCount = 0;

	pagination.init = function(currentPage, pageCount) {
		pagination.currentPage = parseInt(currentPage, 10);
		pagination.pageCount = parseInt(pageCount, 10);

		$('.pagination').on('click', '.select_page', function(e) {
			e.preventDefault();
			bootbox.prompt('Enter page number:', function(pageNum) {
				pagination.loadPage(pageNum);
			});
		});
	};

	pagination.loadPage = function(page, callback) {
		callback = callback || function() {};
		page = parseInt(page, 10);
		if (!utils.isNumber(page) || page < 1 || page > pagination.pageCount) {
			callback(false);
			return false;
		}
		var url = window.location.pathname.slice(1).split('/').slice(0, 3).join('/') + '?page=' + page;
		ajaxify.go(url, callback);
		return true;
	};

	return pagination;
});
