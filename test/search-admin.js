'use strict';


var assert = require('assert');
var search = require('../src/admin/search');

describe('admin search', () => {
	describe('filterDirectories', () => {
		it('should resolve all paths to relative paths', (done) => {
			assert.deepEqual(search.filterDirectories([
				'hfjksfd/fdsgagag/admin/gdhgfsdg/sggag.tpl',
			]), [
				'admin/gdhgfsdg/sggag',
			]);
			done();
		});
		it('should exclude .js files', (done) => {
			assert.deepEqual(search.filterDirectories([
				'hfjksfd/fdsgagag/admin/gdhgfsdg/sggag.tpl',
				'dfahdfsgf/admin/hgkfds/fdhsdfh.js',
			]), [
				'admin/gdhgfsdg/sggag',
			]);
			done();
		});
		it('should exclude partials', (done) => {
			assert.deepEqual(search.filterDirectories([
				'hfjksfd/fdsgagag/admin/gdhgfsdg/sggag.tpl',
				'dfahdfsgf/admin/partials/hgkfds/fdhsdfh.tpl',
			]), [
				'admin/gdhgfsdg/sggag',
			]);
			done();
		});
		it('should exclude files in the admin directory', (done) => {
			assert.deepEqual(search.filterDirectories([
				'hfjksfd/fdsgagag/admin/gdhgfsdg/sggag.tpl',
				'dfdasg/admin/hjkdfsk.tpl',
			]), [
				'admin/gdhgfsdg/sggag',
			]);
			done();
		});
	});

	describe('sanitize', () => {
		it('should strip out scripts', (done) => {
			assert.equal(
				search.sanitize('Pellentesque tristique senectus' +
					'<script>alert("nope");</script> habitant morbi'),
				'Pellentesque tristique senectus' +
					' habitant morbi'
			);
			done();
		});
		it('should remove all tags', (done) => {
			assert.equal(
				search.sanitize('<p>Pellentesque <b>habitant morbi</b> tristique senectus' +
					'Aenean <i>vitae</i> est.Mauris <a href="placerat">eleifend</a> leo.</p>'),
				'Pellentesque habitant morbi tristique senectus' +
					'Aenean vitae est.Mauris eleifend leo.'
			);
			done();
		});
	});

	describe('simplify', () => {
		it('should remove all mustaches', (done) => {
			assert.equal(
				search.simplify('Pellentesque tristique {{senectus}}habitant morbi' +
					'liquam tincidunt {mauris.eu}risus'),
				'Pellentesque tristique habitant morbi' +
					'liquam tincidunt risus'
			);
			done();
		});
		it('should collapse all whitespace', (done) => {
			assert.equal(
				search.simplify('Pellentesque tristique   habitant morbi' +
					'  \n\n    liquam tincidunt mauris eu risus.'),
				'Pellentesque tristique habitant morbi' +
					'\nliquam tincidunt mauris eu risus.'
			);
			done();
		});
	});
});
