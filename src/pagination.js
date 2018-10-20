'use strict';

var qs = require('querystring');
var _ = require('lodash');

var pagination = module.exports;

pagination.create = function (currentPage, pageCount, queryObj) {
	if (pageCount <= 1) {
		return {
			prev: { page: 1, active: currentPage > 1 },
			next: { page: 1, active: currentPage < pageCount },
			rel: [],
			pages: [],
			currentPage: 1,
			pageCount: 1,
		};
	}
	pageCount = parseInt(pageCount, 10);
	var pagesToShow = [1, 2, pageCount - 1, pageCount];

	currentPage = parseInt(currentPage, 10) || 1;
	var previous = Math.max(1, currentPage - 1);
	var next = Math.min(pageCount, currentPage + 1);

	var startPage = Math.max(1, currentPage - 2);
	if (startPage > pageCount - 5) {
		startPage -= 2 - (pageCount - currentPage);
	}
	var i;
	for (i = 0; i < 5; i += 1) {
		pagesToShow.push(startPage + i);
	}

	pagesToShow = _.uniq(pagesToShow).filter(page => page > 0 && page <= pageCount).sort(function (a, b) {
		return a - b;
	});

	queryObj = _.clone(queryObj || {});

	delete queryObj._;

	var pages = pagesToShow.map(function (page) {
		queryObj.page = page;
		return { page: page, active: page === currentPage, qs: qs.stringify(queryObj) };
	});

	for (i = pages.length - 1; i > 0; i -= 1) {
		if (pages[i].page - 2 === pages[i - 1].page) {
			pages.splice(i, 0, { page: pages[i].page - 1, active: false, qs: qs.stringify(queryObj) });
		} else if (pages[i].page - 1 !== pages[i - 1].page) {
			pages.splice(i, 0, { separator: true });
		}
	}

	var data = { rel: [], pages: pages, currentPage: currentPage, pageCount: pageCount };
	queryObj.page = previous;
	data.prev = { page: previous, active: currentPage > 1, qs: qs.stringify(queryObj) };
	queryObj.page = next;
	data.next = { page: next, active: currentPage < pageCount, qs: qs.stringify(queryObj) };

	if (currentPage < pageCount) {
		data.rel.push({
			rel: 'next',
			href: '?page=' + next,
		});
	}

	if (currentPage > 1) {
		data.rel.push({
			rel: 'prev',
			href: '?page=' + previous,
		});
	}
	return data;
};
