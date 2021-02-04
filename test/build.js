'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const async = require('async');

const db = require('./mocks/databasemock');
const file = require('../src/file');

describe('minifier', () => {
	before(async () => {
		await mkdirp(path.join(__dirname, '../build/test'));
	});

	const minifier = require('../src/meta/minifier');
	const scripts = [
		path.resolve(__dirname, './files/1.js'),
		path.resolve(__dirname, './files/2.js'),
	].map(script => ({
		srcPath: script,
		destPath: path.resolve(__dirname, '../build/test', path.basename(script)),
		filename: path.basename(script),
	}));

	it('.js.bundle() should concat scripts', (done) => {
		const destPath = path.resolve(__dirname, '../build/test/concatenated.js');

		minifier.js.bundle({
			files: scripts,
			destPath: destPath,
			filename: 'concatenated.js',
		}, false, false, (err) => {
			assert.ifError(err);

			assert(file.existsSync(destPath));

			assert.strictEqual(
				fs.readFileSync(destPath).toString().replace(/\r\n/g, '\n'),
				'(function (window, document) {' +
				'\n\twindow.doStuff = function () {' +
				'\n\t\tdocument.body.innerHTML = \'Stuff has been done\';' +
				'\n\t};' +
				'\n})(window, document);' +
				'\n' +
				'\n;function foo(name, age) {' +
				'\n\treturn \'The person known as "\' + name + \'" is \' + age + \' years old\';' +
				'\n}' +
				'\n'
			);
			done();
		});
	});
	it('.js.bundle() should minify scripts', (done) => {
		const destPath = path.resolve(__dirname, '../build/test/minified.js');

		minifier.js.bundle({
			files: scripts,
			destPath: destPath,
			filename: 'minified.js',
		}, true, false, (err) => {
			assert.ifError(err);

			assert(file.existsSync(destPath));

			assert.strictEqual(
				fs.readFileSync(destPath).toString(),
				'(function(n,o){n.doStuff=function(){o.body.innerHTML="Stuff has been done"}})(window,document);function foo(n,o){return\'The person known as "\'+n+\'" is \'+o+" years old"}' +
				'\n//# sourceMappingURL=minified.js.map'
			);
			done();
		});
	});

	it('.js.minifyBatch() should minify each script', (done) => {
		minifier.js.minifyBatch(scripts, false, (err) => {
			assert.ifError(err);

			assert(file.existsSync(scripts[0].destPath));
			assert(file.existsSync(scripts[1].destPath));

			fs.readFile(scripts[0].destPath, (err, buffer) => {
				assert.ifError(err);
				assert.strictEqual(
					buffer.toString(),
					'(function(n,o){n.doStuff=function(){o.body.innerHTML="Stuff has been done"}})(window,document);' +
					'\n//# sourceMappingURL=1.js.map'
				);
				done();
			});
		});
	});

	const styles = [
		'@import (inline) "./1.css";',
		'@import "./2.less";',
	].join('\n');
	const paths = [
		path.resolve(__dirname, './files'),
	];
	it('.css.bundle() should concat styles', (done) => {
		minifier.css.bundle(styles, paths, false, false, (err, bundle) => {
			assert.ifError(err);
			assert.strictEqual(bundle.code, '.help { margin: 10px; } .yellow { background: yellow; }\n.help {\n  display: block;\n}\n.help .blue {\n  background: blue;\n}\n');
			done();
		});
	});

	it('.css.bundle() should minify styles', (done) => {
		minifier.css.bundle(styles, paths, true, false, (err, bundle) => {
			assert.ifError(err);
			assert.strictEqual(bundle.code, '.help{margin:10px}.yellow{background:#ff0}.help{display:block}.help .blue{background:#00f}');
			done();
		});
	});
});

describe('Build', (done) => {
	const build = require('../src/meta/build');

	before((done) => {
		async.parallel([
			async.apply(rimraf, path.join(__dirname, '../build/public')),
			async.apply(db.sortedSetAdd, 'plugins:active', Date.now(), 'nodebb-plugin-markdown'),
		], done);
	});

	it('should build plugin static dirs', (done) => {
		build.build(['plugin static dirs'], (err) => {
			assert.ifError(err);
			assert(file.existsSync(path.join(__dirname, '../build/public/plugins/nodebb-plugin-dbsearch/dbsearch')));
			done();
		});
	});

	it('should build requirejs modules', (done) => {
		build.build(['requirejs modules'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/src/modules/Chart.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('/*!\n * Chart.js'));
			done();
		});
	});

	it('should build client js bundle', (done) => {
		build.build(['client js bundle'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/nodebb.min.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).length > 1000);
			done();
		});
	});

	it('should build admin js bundle', (done) => {
		build.build(['admin js bundle'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/acp.min.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).length > 1000);
			done();
		});
	});

	it('should build client side styles', (done) => {
		build.build(['client side styles'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/client.css');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('/*! normalize.css'));
			done();
		});
	});

	it('should build admin control panel styles', (done) => {
		build.build(['admin control panel styles'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/admin.css');
			assert(file.existsSync(filename));
			const adminCSS = fs.readFileSync(filename).toString();
			if (global.env === 'production') {
				assert(adminCSS.startsWith('@charset "UTF-8";') || adminCSS.startsWith('@import url'));
			} else {
				assert(adminCSS.startsWith('.recent-replies'));
			}
			done();
		});
	});

	it('should build templates', function (done) {
		this.timeout(0);
		build.build(['templates'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/templates/admin/header.tpl');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('<!DOCTYPE html>'));
			done();
		});
	});

	it('should build languages', (done) => {
		build.build(['languages'], (err) => {
			assert.ifError(err);

			const globalFile = path.join(__dirname, '../build/public/language/en-GB/global.json');
			assert(file.existsSync(globalFile), 'global.json exists');
			const global = fs.readFileSync(globalFile).toString();
			assert.strictEqual(JSON.parse(global).home, 'Home', 'global.json contains correct translations');

			const mdFile = path.join(__dirname, '../build/public/language/en-GB/markdown.json');
			assert(file.existsSync(mdFile), 'markdown.json exists');
			const md = fs.readFileSync(mdFile).toString();
			assert.strictEqual(JSON.parse(md).bold, 'bolded text', 'markdown.json contains correct translations');

			done();
		});
	});
});
