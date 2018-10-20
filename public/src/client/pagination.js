'use strict';


define('forum/pagination', function () {
	var pagination = {};

	pagination.init = function () {
		$('body').on('click', '[component="pagination/select-page"]', function () {
			bootbox.prompt('[[global:enter_page_number]]', function (pageNum) {
				pagination.loadPage(pageNum);
			});
			return false;
		});
	};

	pagination.loadPage = function (page, callback) {
		callback = callback || function () {};
		page = parseInt(page, 10);
		if (!utils.isNumber(page) || page < 1 || page > ajaxify.data.pagination.pageCount) {
			return;
		}

		var query = utils.params();
		query.page = page;

		var url = window.location.pathname + '?' + $.param(query);
		ajaxify.go(url, callback);
	};

	pagination.nextPage = function (callback) {
		pagination.loadPage(ajaxify.data.pagination.currentPage + 1, callback);
	};

	pagination.previousPage = function (callback) {
		pagination.loadPage(ajaxify.data.pagination.currentPage - 1, callback);
	};

	return pagination;
});
