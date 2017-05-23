'use strict';

var string = require('string');
var path = require('path');
var fs = require('fs');
var assert = require('assert');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

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

describe('Build', function (done) {
	var build = require('../src/meta/build');

	before(function (done) {
		rimraf(path.join(__dirname, '../build/public'), done);
	});

	it('should build plugin static dirs', function (done) {
		build.build(['plugin static dirs'], function (err) {
			assert.ifError(err);
			assert(file.existsSync(path.join(__dirname, '../build/public/plugins/nodebb-plugin-dbsearch/dbsearch')));
			done();
		});
	});

	it('should build requirejs modules', function (done) {
		build.build(['requirejs modules'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/src/modules/Chart.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('/*!\n * Chart.js'));
			done();
		});
	});

	it('should build client js bundle', function (done) {
		build.build(['client js bundle'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/nodebb.min.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).length > 1000);
			done();
		});
	});

	it('should build admin js bundle', function (done) {
		build.build(['admin js bundle'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/acp.min.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).length > 1000);
			done();
		});
	});

	it('should build client side styles', function (done) {
		build.build(['client side styles'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/stylesheet.css');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('/*! normalize.css'));
			done();
		});
	});

	it('should build admin control panel styles', function (done) {
		build.build(['admin control panel styles'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/admin.css');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('@charset "UTF-8";'));
			done();
		});
	});

	it('should build templates', function (done) {
		build.build(['templates'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/templates/admin/header.tpl');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).toString().startsWith('<!DOCTYPE html>'));
			done();
		});
	});

	it('should build languages', function (done) {
		build.build(['languages'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/language/en-GB/global.json');
			assert(file.existsSync(filename));
			var global = fs.readFileSync(filename).toString();
			assert.strictEqual(JSON.parse(global).home, 'Home');
			done();
		});
	});

	it('should build sounds', function (done) {
		build.build(['sounds'], function (err) {
			assert.ifError(err);
			var filename = path.join(__dirname, '../build/public/sounds/fileMap.json');
			assert(file.existsSync(filename));
			done();
		});
	});
});
