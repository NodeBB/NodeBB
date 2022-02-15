'use strict';

const path = require('path');
const fs = require('fs');
const util = require('util');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const rimrafAsync = util.promisify(rimraf);

const file = require('../file');
const plugins = require('../plugins');
const minifier = require('./minifier');

const JS = module.exports;


JS.scripts = {
	base: [
		// 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.min.js',
		'node_modules/@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput.js',
		'node_modules/jquery-serializeobject/jquery.serializeObject.js',
		'public/vendor/bootbox/wrapper.js',
	],

	// plugins add entries into this object,
	// they get linked into /build/public/src/modules
	modules: { },
};

// JS.scripts = {
// 	base: [
// 		'node_modules/socket.io-client/dist/socket.io.js',
// 		'node_modules/requirejs/require.js',
// 		'public/src/require-config.js',
// 		'node_modules/jquery/dist/jquery.js',
// 		'node_modules/textcomplete/dist/textcomplete.min.js',
// 		'node_modules/textcomplete.contenteditable/dist/textcomplete.codemirror.min.js',
// 		'node_modules/visibilityjs/lib/visibility.core.js',
// 		'node_modules/bootstrap/dist/js/bootstrap.js',
// 		'node_modules/@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput.js',
// 		'node_modules/benchpressjs/build/benchpress.js',
// 		'node_modules/jquery-serializeobject/jquery.serializeObject.js',
// 		'node_modules/jquery-deserialize/src/jquery.deserialize.js',

// 		'public/vendor/bootbox/wrapper.js',

// 		'public/src/utils.js',
// 		'public/src/sockets.js',
// 		'public/src/app.js',
// 		'public/src/ajaxify.js',
// 		'public/src/overrides.js',
// 		'public/src/widgets.js',
// 	],

// 	admin: [
// 		'node_modules/material-design-lite/material.js',
// 		'public/src/admin/admin.js',
// 		'node_modules/jquery-deserialize/src/jquery.deserialize.js',
// 	],

// 	// modules listed below are built (/src/modules) so they can be defined anonymously
// 	modules: {
// 		'Chart.js': 'node_modules/chart.js/dist/Chart.min.js',
// 		'mousetrap.js': 'node_modules/mousetrap/mousetrap.min.js',
// 		'cropper.js': 'node_modules/cropperjs/dist/cropper.min.js',
// 		'jquery-ui': 'node_modules/jquery-ui/ui',
// 		'zxcvbn.js': 'node_modules/zxcvbn/dist/zxcvbn.js',

// 		// only get ace files required by acp
// 		'ace/ace.js': 'node_modules/ace-builds/src-min/ace.js',
// 		'ace/mode-less.js': 'node_modules/ace-builds/src-min/mode-less.js',
// 		'ace/mode-javascript.js': 'node_modules/ace-builds/src-min/mode-javascript.js',
// 		'ace/mode-html.js': 'node_modules/ace-builds/src-min/mode-html.js',
// 		'ace/theme-twilight.js': 'node_modules/ace-builds/src-min/theme-twilight.js',
// 		'ace/worker-css.js': 'node_modules/ace-builds/src-min/worker-css.js',
// 		'ace/worker-javascript.js': 'node_modules/ace-builds/src-min/worker-javascript.js',
// 		'ace/worker-html.js': 'node_modules/ace-builds/src-min/worker-html.js',
// 		'ace/ext-searchbox.js': 'node_modules/ace-builds/src-min/ext-searchbox.js',

// 		'clipboard.js': 'node_modules/clipboard/dist/clipboard.min.js',
// 		'tinycon.js': 'node_modules/tinycon/tinycon.js',
// 		'slideout.js': 'node_modules/slideout/dist/slideout.min.js',
// 		'compare-versions.js': 'node_modules/compare-versions/index.js',
// 		'timeago/locales': 'node_modules/timeago/locales',
// 		'jquery-form.js': 'node_modules/jquery-form/dist/jquery.form.min.js',
// 		'xregexp.js': 'node_modules/xregexp/xregexp-all.js',
// 	},
// };

async function linkIfLinux(srcPath, destPath) {
	if (process.platform === 'win32') {
		await fs.promises.copyFile(srcPath, destPath);
	} else {
		await file.link(srcPath, destPath, true);
	}
}

const basePath = path.resolve(__dirname, '../..');

async function linkModules() {
	const { modules } = JS.scripts;

	await Promise.all([
		mkdirp(path.join(__dirname, '../../build/public/src/modules/admin/plugins')),
		mkdirp(path.join(__dirname, '../../build/public/src/modules/forum/plugins')),
	]);

	await Promise.all(Object.keys(modules).map(async (relPath) => {
		const srcPath = path.join(__dirname, '../../', modules[relPath]);
		const destPath = path.join(__dirname, '../../build/public/src/modules', relPath);
		const [stats] = await Promise.all([
			fs.promises.stat(srcPath),
			mkdirp(path.dirname(destPath)),
		]);
		if (stats.isDirectory()) {
			await file.linkDirs(srcPath, destPath, true);
		} else {
			await linkIfLinux(srcPath, destPath);
		}
	}));
}

const moduleDirs = ['modules', 'admin', 'client'];

async function clearModules() {
	const builtPaths = moduleDirs.map(
		p => path.join(__dirname, '../../build/public/src', p)
	);
	await Promise.all(
		builtPaths.map(builtPath => rimrafAsync(builtPath))
	);
}

JS.buildModules = async function () {
	await clearModules();
	await linkModules();
};

JS.linkStatics = async function () {
	await rimrafAsync(path.join(__dirname, '../../build/public/plugins'));

	await Promise.all(Object.keys(plugins.staticDirs).map(async (mappedPath) => {
		const sourceDir = plugins.staticDirs[mappedPath];
		const destDir = path.join(__dirname, '../../build/public/plugins', mappedPath);

		await mkdirp(path.dirname(destDir));
		await file.linkDirs(sourceDir, destDir, true);
	}));
};

async function getBundleScriptList(target) {
	const pluginDirectories = [];

	if (target === 'admin') {
		target = 'acp';
	}
	let pluginScripts = plugins[`${target}Scripts`].filter((path) => {
		if (path.endsWith('.js')) {
			return true;
		}

		pluginDirectories.push(path);
		return false;
	});

	await Promise.all(pluginDirectories.map(async (directory) => {
		const scripts = await file.walk(directory);
		pluginScripts = pluginScripts.concat(scripts);
	}));

	pluginScripts = JS.scripts.base.concat(pluginScripts).map((script) => {
		const srcPath = path.resolve(basePath, script).replace(/\\/g, '/');
		return {
			srcPath: srcPath,
			filename: path.relative(basePath, srcPath).replace(/\\/g, '/'),
		};
	});

	return pluginScripts;
}

JS.buildBundle = async function (target, fork) {
	const fileNames = {
		client: 'client-scripts.min.js',
		admin: 'acp-scripts.min.js',
	};

	const files = await getBundleScriptList(target);
	const minify = process.env.NODE_ENV !== 'development';
	const filePath = path.join(__dirname, '../../build/public', fileNames[target]);

	await minifier.js.bundle({
		files: files,
		filename: fileNames[target],
		destPath: filePath,
	}, minify, fork);
};

JS.killMinifier = function () {
	minifier.killAll();
};
