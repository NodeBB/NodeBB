

define(function() {
	var pagination = {};

	pagination.currentPage = 0;
	pagination.pageCount = 0;
	pagination.loadFunction = null;

	pagination.init = function(currentPage, pageCount, loadFunction) {
		pagination.currentPage = parseInt(currentPage, 10);
		pagination.pageCount = parseInt(pageCount, 10);
		pagination.loadFunction = loadFunction;

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

	pagination.recreatePaginationLinks = function(newPageCount) {
		pagination.pageCount = parseInt(newPageCount);

		var pages = [];
		for(var i=1; i<=pagination.page; ++i) {
			pages.push({pageNumber: i});
		}

		var html = templates.prepare(templates['topic'].blocks['pages']).parse({pages:pages});
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

		pagination.loadFunction(page, function(err) {
			if(err) {
				return app.alertError(err.message);
			}

			pagination.currentPage = parseInt(page, 10);
			updatePageLinks();
		});
	}


	function updatePageLinks() {
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
	}

	return pagination;
});