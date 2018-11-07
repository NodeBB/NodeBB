'use strict';

var path = require('path');
var fs = require('fs');
var assert = require('assert');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var async = require('async');

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
	].map(function (script) {
		return {
			srcPath: script,
			destPath: path.resolve(__dirname, '../build/test', path.basename(script)),
			filename: path.basename(script),
		};
	});

	it('.js.bundle() should concat scripts', function (done) {
		var destPath = path.resolve(__dirname, '../build/test/concatenated.js');

		minifier.js.bundle({
			files: scripts,
			destPath: destPath,
			filename: 'concatenated.js',
		}, false, false, function (err) {
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
	it('.js.bundle() should minify scripts', function (done) {
		var destPath = path.resolve(__dirname, '../build/test/minified.js');

		minifier.js.bundle({
			files: scripts,
			destPath: destPath,
			filename: 'minified.js',
		}, true, false, function (err) {
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

	it('.js.minifyBatch() should minify each script', function (done) {
		minifier.js.minifyBatch(scripts, false, function (err) {
			assert.ifError(err);

			assert(file.existsSync(scripts[0].destPath));
			assert(file.existsSync(scripts[1].destPath));

			fs.readFile(scripts[0].destPath, function (err, buffer) {
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
			assert.strictEqual(bundle.code, '.help{margin:10px}.yellow{background:#ff0}.help{display:block}.help .blue{background:#00f}');
			done();
		});
	});
});

describe('Build', function (done) {
	var build = require('../src/meta/build');

	before(function (done) {
		async.parallel([
			async.apply(rimraf, path.join(__dirname, '../build/public')),
			async.apply(db.activatePlugin, 'nodebb-plugin-markdown'),
		], done);
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
			var filename = path.join(__dirname, '../build/public/client.css');
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
			var adminCSS = fs.readFileSync(filename).toString();
			assert(adminCSS.startsWith('@charset "UTF-8";') || adminCSS.startsWith('@import url'));
			done();
		});
	});

	it('should build templates', function (done) {
		this.timeout(0);
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

			var globalFile = path.join(__dirname, '../build/public/language/en-GB/global.json');
			assert(file.existsSync(globalFile), 'global.json exists');
			var global = fs.readFileSync(globalFile).toString();
			assert.strictEqual(JSON.parse(global).home, 'Home', 'global.json contains correct translations');

			var mdFile = path.join(__dirname, '../build/public/language/en-GB/markdown.json');
			assert(file.existsSync(mdFile), 'markdown.json exists');
			var md = fs.readFileSync(mdFile).toString();
			assert.strictEqual(JSON.parse(md).bold, 'bolded text', 'markdown.json contains correct translations');

			done();
		});
	});

	it('should build sounds', function (done) {
		build.build(['sounds'], function (err) {
			assert.ifError(err);

			var mapFile = path.join(__dirname, '../build/public/sounds/fileMap.json');
			assert(file.existsSync(mapFile));
			var fileMap = JSON.parse(fs.readFileSync(mapFile));
			assert.strictEqual(fileMap['Default | Deedle-dum'], 'nodebb-plugin-soundpack-default/notification.mp3');

			var deebleDumFile = path.join(__dirname, '../build/public/sounds/nodebb-plugin-soundpack-default/notification.mp3');
			assert(file.existsSync(deebleDumFile));

			done();
		});
	});
});
