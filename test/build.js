'use strict';

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { mkdirp } = require('mkdirp');

const db = require('./mocks/databasemock');
const file = require('../src/file');

describe('minifier', () => {
	const testPath = path.join(__dirname, '../test/build');
	before(async () => {
		await mkdirp(testPath);
	});

	after(async () => {
		const files = await file.walk(testPath);
		await Promise.all(files.map(async path => fs.promises.rm(path)));
		await fs.promises.rmdir(testPath);
	});

	const minifier = require('../src/meta/minifier');
	const scripts = [
		path.resolve(__dirname, './files/1.js'),
		path.resolve(__dirname, './files/2.js'),
	].map(script => ({
		srcPath: script,
		destPath: path.resolve(__dirname, '../test/build', path.basename(script)),
		filename: path.basename(script),
	}));

	it('.js.bundle() should concat scripts', (done) => {
		const destPath = path.resolve(__dirname, '../test/build/concatenated.js');

		minifier.js.bundle({
			files: scripts,
			destPath: destPath,
			filename: 'concatenated.js',
		}, false, (err) => {
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

	const styles = [
		'@import "./1";',
		'@import "./2.scss";',
	].join('\n');
	const paths = [
		path.resolve(__dirname, './files'),
	];
	it('.css.bundle() should concat styles', (done) => {
		minifier.css.bundle(styles, paths, false, false, 'ltr', (err, bundle) => {
			assert.ifError(err);
			assert.strictEqual(bundle.ltr.code, '.help {\n  margin: 10px;\n}\n\n.yellow {\n  background: yellow;\n}\n\n.help {\n  display: block;\n}\n.help .blue {\n  background: blue;\n}');
			done();
		});
	});

	it('.css.bundle() should minify styles', (done) => {
		minifier.css.bundle(styles, paths, true, false, 'ltr', (err, bundle) => {
			assert.ifError(err);
			assert.strictEqual(bundle.ltr.code, '.help{margin:10px}.yellow{background:#ff0}.help{display:block}.help .blue{background:#00f}');
			done();
		});
	});
});

describe('Build', () => {
	const build = require('../src/meta/build');

	before(async () => {
		await fs.promises.rm(path.join(__dirname, '../build/public'), { recursive: true, force: true });
		await db.sortedSetAdd('plugins:active', Date.now(), 'nodebb-plugin-markdown');
	});

	it('should build plugin static dirs', (done) => {
		build.build(['plugin static dirs'], (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should build requirejs modules', (done) => {
		build.build(['requirejs modules'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/src/modules/alerts.js');
			assert(file.existsSync(filename));
			done();
		});
	});

	it('should build client js bundle', (done) => {
		build.build(['client js bundle'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/scripts-client.js');
			assert(file.existsSync(filename));
			assert(fs.readFileSync(filename).length > 1000);
			done();
		});
	});

	it('should build admin js bundle', (done) => {
		build.build(['admin js bundle'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/scripts-admin.js');
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
			done();
		});
	});

	it('should build admin control panel styles', (done) => {
		build.build(['admin control panel styles'], (err) => {
			assert.ifError(err);
			const filename = path.join(__dirname, '../build/public/admin.css');
			assert(file.existsSync(filename));
			done();
		});
	});


	/* disabled, doesn't work on gh actions in prod mode
	it('should build bundle files', function (done) {
		this.timeout(0);
		build.buildAll(async (err) => {
			assert.ifError(err);
			assert(file.existsSync(path.join(__dirname, '../build/webpack/nodebb.min.js')));
			assert(file.existsSync(path.join(__dirname, '../build/webpack/admin.min.js')));
			let { res, body } = await helpers.request('GET', `/assets/nodebb.min.js`, {});
			assert(res.statusCode, 200);
			assert(body);
			({ res, body } = await helpers.request('GET', `/assets/admin.min.js`, {}));
			assert(res.statusCode, 200);
			assert(body);
			done();
		});
	});
	*/

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
