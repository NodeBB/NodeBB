'use strict';

var pagination = {};

pagination.create = function(currentPage, pageCount, data) {

	if (pageCount <= 1) {
		data.pagination = {
			prev: {page: 1, active: currentPage > 1},
			next: {page: 1, active: currentPage < pageCount},
			rel: [],
			pages: []
		};
		return;
	}

	var pagesToShow = [1];
	if (pageCount !== 1) {
		pagesToShow.push(pageCount);
	}

	currentPage = parseInt(currentPage, 10) || 1;
	var previous = Math.max(1, currentPage - 1);
	var next = Math.min(pageCount, currentPage + 1);

	var startPage = currentPage - 2;
	for(var i=0; i<5; ++i) {
		var p = startPage + i;
		if (p >= 1 && p <= pageCount && pagesToShow.indexOf(p) === -1) {
			pagesToShow.push(startPage + i);
		}
	}

	pagesToShow.sort(function(a, b) {
		return a - b;
	});

	var pages = pagesToShow.map(function(page) {
		return {page: page, active: page === currentPage};
	});

	data.pagination = {
		prev: {page: previous, active: currentPage > 1},
		next: {page: next, active: currentPage < pageCount},
		rel: [],
		pages: pages
	};

	if (currentPage < pageCount) {
		data.pagination.rel.push({
			rel: 'next',
			href: '?page=' + next
		});
	}

	if (currentPage > 1) {
		data.pagination.rel.push({
			rel: 'prev',
			href: '?page=' + previous
		});
	}

};


module.exports = pagination;