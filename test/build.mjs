import path from 'path';
import fs from 'fs/promises';
import assert from 'assert';
import { mkdirp } from 'mkdirp';
import { fileURLToPath } from 'url';

import db from './mocks/databasemock.mjs';
import file from '../src/file.js';
import minifier from '../src/meta/minifier.js';
import build from '../src/meta/build.js';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('minifier', () => {
	const testPath = path.join(__dirname, '../test/build');

	before(async () => {
		await mkdirp(testPath);
	});

	after(async () => {
		const files = await file.walk(testPath);
		await Promise.all(files.map(path => fs.rm(path)));
		await fs.rmdir(testPath);
	});

	const scripts = [
		path.resolve(__dirname, './files/1.js'),
		path.resolve(__dirname, './files/2.js'),
	].map(script => ({
		srcPath: script,
		destPath: path.resolve(__dirname, '../test/build', path.basename(script)),
		filename: path.basename(script),
	}));

	it('should concat scripts', async () => {
		const destPath = path.resolve(__dirname, '../test/build/concatenated.js');

		await new Promise((resolve, reject) => {
			minifier.js.bundle(
				{
					files: scripts,
					destPath,
					filename: 'concatenated.js',
				},
				false,
				(err) => {
					if (err) reject(err);
					else resolve();
				}
			);
		});

		assert(file.existsSync(destPath));

		assert.strictEqual(
			(await fs.readFile(destPath)).toString().replace(/\r\n/g, '\n'),
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
	});

	const styles = ['@import "./1";', '@import "./2.scss";'].join('\n');
	const paths = [path.resolve(__dirname, './files')];

	it('should concat styles', async () => {
		const bundle = await new Promise((resolve, reject) => {
			minifier.css.bundle(styles, paths, false, false, 'ltr', (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});

		assert.strictEqual(
			bundle.ltr.code,
			'.help {\n  margin: 10px;\n}\n\n.yellow {\n  background: yellow;\n}\n\n.help {\n  display: block;\n}\n.help .blue {\n  background: blue;\n}'
		);
	});

	it('should minify styles', async () => {
		const bundle = await new Promise((resolve, reject) => {
			minifier.css.bundle(styles, paths, true, false, 'ltr', (err, result) => {
				if (err) reject(err);
				else resolve(result);
			});
		});

		assert.strictEqual(
			bundle.ltr.code,
			'.help{margin:10px}.yellow{background:#ff0}.help{display:block}.help .blue{background:#00f}'
		);
	});
});

describe('Build', () => {
	before(async () => {
		await fs.rm(path.join(__dirname, '../build/public'), { recursive: true, force: true });
		await db.sortedSetAdd('plugins:active', Date.now(), 'nodebb-plugin-markdown');
	});

	it('should build plugin static dirs', async () => {
		await new Promise((resolve, reject) => {
			build.build(['plugin static dirs'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	});

	it('should build requirejs modules', async () => {
		await new Promise((resolve, reject) => {
			build.build(['requirejs modules'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const filename = path.join(__dirname, '../build/public/src/modules/alerts.js');
		assert(file.existsSync(filename));
	});

	it('should build client js bundle', async () => {
		await build.build(['client js bundle']);

		const filename = path.join(__dirname, '../build/public/scripts-client.js');
		assert(file.existsSync(filename));
		assert((await fs.readFile(filename)).length > 1000);
	});

	it('should build admin js bundle', async () => {
		await new Promise((resolve, reject) => {
			build.build(['admin js bundle'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const filename = path.join(__dirname, '../build/public/scripts-admin.js');
		assert(file.existsSync(filename));
		assert((await fs.readFile(filename)).length > 1000);
	});

	it('should build client side styles', async () => {
		await new Promise((resolve, reject) => {
			build.build(['client side styles'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const filename = path.join(__dirname, '../build/public/client.css');
		assert(file.existsSync(filename));
	});

	it('should build admin control panel styles', async () => {
		await new Promise((resolve, reject) => {
			build.build(['admin control panel styles'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const filename = path.join(__dirname, '../build/public/admin.css');
		assert(file.existsSync(filename));
	});

	/* disabled, doesn't work on GitHub Actions in prod mode
	it('should build bundle files', async function () {
		this.timeout(0);
	  await new Promise((resolve, reject) => {
		build.buildAll((err) => {
		  if (err) reject(err);
		  else resolve();
		});
	  });
  
			assert(file.existsSync(path.join(__dirname, '../build/webpack/nodebb.min.js')));
			assert(file.existsSync(path.join(__dirname, '../build/webpack/admin.min.js')));
  
			let { res, body } = await helpers.request('GET', `/assets/nodebb.min.js`, {});
	  assert.strictEqual(res.statusCode, 200);
			assert(body);
  
			({ res, body } = await helpers.request('GET', `/assets/admin.min.js`, {}));
	  assert.strictEqual(res.statusCode, 200);
			assert(body);
	});
	*/

	it('should build templates', async function () {
		this.timeout(0);
		await new Promise((resolve, reject) => {
			build.build(['templates'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const filename = path.join(__dirname, '../build/public/templates/admin/header.tpl');
		assert(file.existsSync(filename));
		assert((await fs.readFile(filename)).toString().startsWith('<!DOCTYPE html>'));
	});

	it('should build languages', async () => {
		await new Promise((resolve, reject) => {
			build.build(['languages'], (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const globalFile = path.join(__dirname, '../build/public/language/en-GB/global.json');
		assert(file.existsSync(globalFile), 'global.json exists');
		const global = (await fs.readFile(globalFile)).toString();
		assert.strictEqual(JSON.parse(global).home, 'Home', 'global.json contains correct translations');

		const mdFile = path.join(__dirname, '../build/public/language/en-GB/markdown.json');
		assert(file.existsSync(mdFile), 'markdown.json exists');
		const md = (await fs.readFile(mdFile)).toString();
		assert.strictEqual(JSON.parse(md).bold, 'bolded text', 'markdown.json contains correct translations');
	});
});