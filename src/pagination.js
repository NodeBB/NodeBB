'use strict';

var qs = require('querystring');
var winston = require('winston');
var utils = require('../public/src/utils');


var pagination = {};

/* 
* Generic Pagination logic
*/
pagination.create = function(
	currentPage, // 1-based string
	pageCount,   // total number of pages - integer. May exceed immediately displayable number of pages.
	queryObj) {  // ? - add doc string
	
	currentPage   = parseInt(currentPage, 10) || 1; // 1-based
	var pagesToShow = Math.min(pageCount, 10); // don't render more than 10 page links at once
    var startPage = 1 + Math.floor((currentPage - 1) / pagesToShow) * pagesToShow;
    var lastPage  = Math.min(startPage + pagesToShow, pageCount+1); // last page is just beyong current chapter

	winston.debug("[pagination]: ", currentPage,"/", pageCount, " shown=", pagesToShow," [",startPage, ":", lastPage,"]");
	var pages = [];
	queryObj = queryObj || {};

	for(var x=startPage; x < lastPage; x++) {
		queryObj.page = x;
		pages.push({
			page:   x,
			active: x == currentPage,
			qs:     qs.stringify(queryObj)
		});
	}

	var data = {
	 	prev: { // prev chapter link
			 	page: Math.max(1, startPage-1),
			 	active: startPage > 1
			},
		next: { // next chapter link
			 	page:   lastPage,
			 	active: lastPage <= pageCount
			},
		rel: [],
		pages: pages
	 };


	/* pagination rel tags  <link rel={prev|next} /> */
   if (currentPage < pageCount) {
		data.rel.push({
			rel: 'next',
			href: '?page=' + (currentPage+1)
        });
    }

	if(currentPage > 1){
		data.rel.push({
			rel: 'prev',
			href: '?page=' + (currentPage-1)
		});
	 }

	winston.debug("[pagination] %j", data);
	return data;
};


module.exports = pagination;