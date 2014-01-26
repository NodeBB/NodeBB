

define(function() {
	var pagination = {};

	pagination.currentPage = 0;
	pagination.pageCount = 0;

	pagination.init = function(currentPage, pageCount) {
		pagination.currentPage = parseInt(currentPage, 10);
		pagination.pageCount = parseInt(pageCount, 10);

		updatePageLinks();

		$('.pagination').on('click', '.previous', function() {
			pagination.loadPage(pagination.currentPage - 1);
		});

		$('.pagination').on('click', '.next', function() {
			pagination.loadPage(pagination.currentPage + 1);
		});

		$('.pagination').on('click', '.page', function() {
			pagination.loadPage($(this).attr('data-page'));
		});
	}

	pagination.recreatePaginationLinks = function(template, newPageCount) {
		pagination.pageCount = parseInt(newPageCount, 10);

		var pages = [];
		for(var i=1; i<=pagination.pageCount; ++i) {
			pages.push({pageNumber: i});
		}

		var html = templates.prepare(templates[template].blocks['pages']).parse({pages:pages});
		html = $(html);
		$('.pagination li.page').remove();
		html.insertAfter($('.pagination li.previous'));
		updatePageLinks();
	}

	pagination.loadPage = function(page, callback) {
		page = parseInt(page, 10);
		if(page < 1 || page > pagination.pageCount) {
			return;
		}

		ajaxify.go(window.location.pathname.slice(1) + '?page=' + page);
	}

	function updatePageLinks() {
		if(pagination.pageCount === 0) {
			$('.pagination').addClass('hide');
		} else {
			$('.pagination').removeClass('hide');
		}

		$('.pagination .next').removeClass('disabled');
		$('.pagination .previous').removeClass('disabled');

		if(pagination.currentPage === 1) {
			$('.pagination .previous').addClass('disabled');
		}

		if(pagination.currentPage === pagination.pageCount) {
			$('.pagination .next').addClass('disabled');
		}

		$('.pagination .page').removeClass('active');
		$('.pagination .page[data-page="' + pagination.currentPage + '"]').addClass('active');
		$('.pagination .page').each(function(index, element) {
			var li = $(this);
			var page = li.attr('data-page');
			li.find('a').attr('href', window.location.pathname + '?page=' + page);
		});
	}

	return pagination;
});