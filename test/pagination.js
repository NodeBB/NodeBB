'use strict';
/*global require*/

var	assert = require('assert');
var pagination = require('../src/pagination');

describe('Pagination', function () {

	it('should create empty pagination for 1 page', function (done) {
		var data = pagination.create(1, 1);
		assert.equal(data.pages.length, 0);
		assert.equal(data.rel.length, 0);
		assert.equal(data.pageCount, 1);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 1);
		done();
	});

	it('should create pagination for 5 pages', function (done) {
		var data = pagination.create(2, 5);
		assert.equal(data.pages.length, 5);
		assert.equal(data.rel.length, 2);
		assert.equal(data.pageCount, 5);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 3);
		done();
	});

	it('should create pagination for 3 pages with query params', function (done) {
		var data = pagination.create(1, 3, {key: 'value'});
		assert.equal(data.pages.length, 3);
		assert.equal(data.rel.length, 1);
		assert.equal(data.pageCount, 3);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 2);
		assert.equal(data.pages[0].qs, 'key=value&page=1');
		done();
	});
});
