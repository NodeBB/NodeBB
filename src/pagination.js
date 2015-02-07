'use strict';

var qs = require('querystring');

var pagination = {};

pagination.create = function(currentPage, pageCount, queryObj) {
	if (pageCount <= 1) {
		return {
			prev: {page: 1, active: currentPage > 1},
			next: {page: 1, active: currentPage < pageCount},
			rel: [],
			pages: []
		};
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

	queryObj = queryObj || {};

	var pages = pagesToShow.map(function(page) {
		queryObj.page = page;
		return {page: page, active: page === currentPage, qs: qs.stringify(queryObj)};
	});

	var data = {
		prev: {page: previous, active: currentPage > 1},
		next: {page: next, active: currentPage < pageCount},
		rel: [],
		pages: pages
	};

	if (currentPage < pageCount) {
		data.rel.push({
			rel: 'next',
			href: '?page=' + next
		});
	}

	if (currentPage > 1) {
		data.rel.push({
			rel: 'prev',
			href: '?page=' + previous
		});
	}
	return data;
};


module.exports = pagination;