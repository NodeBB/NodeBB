'use strict';


const assert = require('assert');
const pagination = require('../src/pagination');

describe('Pagination', () => {
	it('should create empty pagination for 1 page', (done) => {
		const data = pagination.create(1, 1);
		assert.equal(data.pages.length, 0);
		assert.equal(data.rel.length, 0);
		assert.equal(data.pageCount, 1);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 1);
		done();
	});

	it('should create pagination for 10 pages', (done) => {
		const data = pagination.create(2, 10);
		// [1, (2), 3, 4, 5, separator, 9, 10]
		assert.equal(data.pages.length, 8);
		assert.equal(data.rel.length, 2);
		assert.equal(data.pageCount, 10);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 3);
		done();
	});

	it('should create pagination for 18 pages and should not turn page 3 into separator', (done) => {
		const data = pagination.create(6, 18);
		// [1, 2, 3, 4, 5, (6), 7, 8, seperator, 17, 18]
		assert.equal(data.pages.length, 11);
		assert.equal(data.rel.length, 2);
		assert.strictEqual(data.pages[2].qs, 'page=3');
		assert.equal(data.pageCount, 18);
		assert.equal(data.prev.page, 5);
		assert.equal(data.next.page, 7);
		done();
	});

	it('should create pagination for 3 pages with query params', (done) => {
		const data = pagination.create(1, 3, { key: 'value' });
		assert.equal(data.pages.length, 3);
		assert.equal(data.rel.length, 1);
		assert.equal(data.pageCount, 3);
		assert.equal(data.prev.page, 1);
		assert.equal(data.next.page, 2);
		assert.equal(data.pages[0].qs, 'key=value&page=1');
		done();
	});
});
