'use strict';

var string = require('string');
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var mkdirp = require('mkdirp');

var db = require('./mocks/databasemock');
var file = require('../src/file');

describe('minifier', function () {
	before(function (done) {
		mkdirp(path.join(__dirname, '../build/test'), done);
	});

	var minifier = require('../src/meta/minifier');
	var scripts = [
		path.resolve(__dirname, './files/1.js'),
		path.resolve(__dirname, './files/2.js'),
	];
	it('.js.bundle() should concat scripts', function (done) {
		minifier.js.bundle(scripts, false, false, function (err, bundle) {
			assert.ifError(err);
			assert.strictEqual(
				bundle.code,
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

	it('.js.bundle() should minify scripts', function (done) {
		minifier.js.bundle(scripts, true, false, function (err, bundle) {
			assert.ifError(err);
			assert.strictEqual(
				bundle.code,
				'(function(n,o){n.doStuff=function(){o.body.innerHTML="Stuff has been done"}})(window,document);function foo(n,o){return\'The person known as "\'+n+\'" is \'+o+" years old"}'
			);
			done();
		});
	});

	it('.js.minifyBatch() should minify each script', function (done) {
		var s = scripts.map(function (script) {
			return {
				srcPath: script,
				destPath: path.resolve(__dirname, '../build/test', path.basename(script)),
			};
		});
		minifier.js.minifyBatch(s, false, function (err) {
			assert.ifError(err);

			assert(file.existsSync(s[0].destPath));
			assert(file.existsSync(s[1].destPath));

			fs.readFile(s[0].destPath, function (err, buffer) {
				assert.ifError(err);
				assert.strictEqual(
					buffer.toString(),
					'(function(n,o){n.doStuff=function(){o.body.innerHTML="Stuff has been done"}})(window,document);'
				);
				done();
			});
		});
	});

	var styles = [
		'@import (inline) "./1.css";',
		'@import "./2.less";',
	].join('\n');
	var paths = [
		path.resolve(__dirname, './files'),
	];
	it('.css.bundle() should concat styles', function (done) {
		minifier.css.bundle(styles, paths, false, false, function (err, bundle) {
			assert.ifError(err);
			assert.strictEqual(bundle.code, '.help { margin: 10px; } .yellow { background: yellow; }\n.help {\n  display: block;\n}\n.help .blue {\n  background: blue;\n}\n');
			done();
		});
	});

	it('.css.bundle() should minify styles', function (done) {
		minifier.css.bundle(styles, paths, true, false, function (err, bundle) {
			assert.ifError(err);
			assert.strictEqual(bundle.code, '.help{margin:10px;display:block}.yellow{background:#ff0}.help .blue{background:#00f}');
			done();
		});
	});
});

describe('Build', function () {
	it('should build all assets', function (done) {
		this.timeout(50000);
		var build = require('../src/meta/build');
		build.buildAll(function (err) {
			assert.ifError(err);
			done();
		});
	});
});
