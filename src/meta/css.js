'use strict';

const winston = require('winston');
const nconf = require('nconf');
const fs = require('fs');
const path = require('path');

const plugins = require('../plugins');
const db = require('../database');
const file = require('../file');
const minifier = require('./minifier');

const CSS = module.exports;

CSS.supportedSkins = [
	'cerulean', 'cosmo', 'cyborg', 'darkly', 'flatly', 'journal', 'litera',
	'lumen', 'lux', 'materia', 'minty', 'morph', 'pulse', 'quartz', 'sandstone',
	'simplex', 'sketchy', 'slate', 'solar', 'spacelab', 'superhero', 'united',
	'vapor', 'yeti', 'zephyr',
];

const buildImports = {
	client: function (source, themeData) {
		return [
			boostrapImport(themeData),
			'@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			source,
			'@import "jquery-ui";',
			'@import "cropperjs/dist/cropper";',
		].join('\n');
	},
	admin: function (source) {
		return [
			'@import "admin/vars";',
			'@import "bootswatch/dist/materia/variables";',
			'@import "bootstrap/scss/bootstrap";',
			'@import "bootswatch/dist/materia/bootswatch";',
			'@import "mixins";',
			'@import "fontawesome";',
			'@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			'@import "generics";',
			'@import "responsive-utilities";',
			'@import "admin/admin";',
			source,
			'@import "jquery-ui";',
		].join('\n');
	},
};

function boostrapImport(themeData) {
	// see https://getbootstrap.com/docs/5.0/customize/sass/#variable-defaults
	// for an explanation of this order and https://bootswatch.com/help/
	const { bootswatchSkin } = themeData;
	return [
		bootswatchSkin ? `@import "bootswatch/dist/${bootswatchSkin}/variables";` : '',
		'@import "bootstrap/scss/mixins/banner";',
		'@include bsBanner("");',
		// functions must be included first
		'@import "bootstrap/scss/functions";',

		// overrides for bs5 variables
		'@import "./scss/overrides";', // this file is in the themes scss folder
		'@import "overrides.scss";', // core scss overrides

		// bs files
		'@import "bootstrap/scss/variables";',
		'@import "bootstrap/scss/variables-dark";',
		'@import "bootstrap/scss/maps";',
		'@import "bootstrap/scss/mixins";',
		'@import "bootstrap/scss/utilities";',

		// Layout & components
		'@import "bootstrap/scss/root";',
		'@import "bootstrap/scss/reboot";',
		'@import "bootstrap/scss/type";',
		'@import "bootstrap/scss/images";',
		'@import "bootstrap/scss/containers";',
		'@import "bootstrap/scss/grid";',
		'@import "bootstrap/scss/tables";',
		'@import "bootstrap/scss/forms";',
		'@import "bootstrap/scss/buttons";',
		'@import "bootstrap/scss/transitions";',
		'@import "bootstrap/scss/dropdown";',
		'@import "bootstrap/scss/button-group";',
		'@import "bootstrap/scss/nav";',
		'@import "bootstrap/scss/navbar";',
		'@import "bootstrap/scss/card";',
		'@import "bootstrap/scss/accordion";',
		'@import "bootstrap/scss/breadcrumb";',
		'@import "bootstrap/scss/pagination";',
		'@import "bootstrap/scss/badge";',
		'@import "bootstrap/scss/alert";',
		'@import "bootstrap/scss/progress";',
		'@import "bootstrap/scss/list-group";',
		'@import "bootstrap/scss/close";',
		'@import "bootstrap/scss/toasts";',
		'@import "bootstrap/scss/modal";',
		'@import "bootstrap/scss/tooltip";',
		'@import "bootstrap/scss/popover";',
		'@import "bootstrap/scss/carousel";',
		'@import "bootstrap/scss/spinners";',
		'@import "bootstrap/scss/offcanvas";',
		'@import "bootstrap/scss/placeholders";',

		// Helpers
		'@import "bootstrap/scss/helpers";',

		'@import "responsive-utilities";',

		// Utilities
		'@import "bootstrap/scss/utilities/api";',
		// scss-docs-end import-stack

		'@import "fontawesome";',
		'@import "mixins";', // core mixins
		'@import "generics";',
		'@import "client";', // core page styles
		'@import "./theme";', // rest of the theme scss
		bootswatchSkin ? `@import "bootswatch/dist/${bootswatchSkin}/bootswatch";` : '',
	].join('\n');
}

async function filterMissingFiles(filepaths) {
	const exists = await Promise.all(
		filepaths.map(async (filepath) => {
			const exists = await file.exists(path.join(__dirname, '../../node_modules', filepath));
			if (!exists) {
				winston.warn(`[meta/css] File not found! ${filepath}`);
			}
			return exists;
		})
	);
	return filepaths.filter((filePath, i) => exists[i]);
}

async function getImports(files, extension) {
	const pluginDirectories = [];
	let source = '';

	function pathToImport(file) {
		if (!file) {
			return '';
		}
		// trim css extension so it inlines the css like less (inline)
		const parsed = path.parse(file);
		const newFile = path.join(parsed.dir, parsed.name);
		return `\n@import "${newFile.replace(/\\/g, '/')}";`;
	}

	files.forEach((styleFile) => {
		if (styleFile.endsWith(extension)) {
			source += pathToImport(styleFile);
		} else {
			pluginDirectories.push(styleFile);
		}
	});
	await Promise.all(pluginDirectories.map(async (directory) => {
		const styleFiles = await file.walk(directory);
		styleFiles.forEach((styleFile) => {
			source += pathToImport(styleFile);
		});
	}));
	return source;
}

async function getBundleMetadata(target) {
	const paths = [
		path.join(__dirname, '../../node_modules'),
		path.join(__dirname, '../../public/scss'),
		path.join(__dirname, '../../public/vendor/fontawesome/scss'),
	];

	// Skin support
	let skin;
	if (target.startsWith('client-')) {
		skin = target.split('-')[1];

		if (CSS.supportedSkins.includes(skin)) {
			target = 'client';
		}
	}

	let themeData = null;
	if (target === 'client') {
		themeData = await db.getObjectFields('config', ['theme:type', 'theme:id', 'bootswatchSkin']);
		const themeId = (themeData['theme:id'] || 'nodebb-theme-harmony');
		const baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-harmony'));
		paths.unshift(baseThemePath);
		paths.unshift(`${baseThemePath}/node_modules`);

		themeData.bootswatchSkin = skin || themeData.bootswatchSkin;
	}

	const [scssImports, cssImports, acpScssImports] = await Promise.all([
		filterGetImports(plugins.scssFiles, '.scss'),
		filterGetImports(plugins.cssFiles, '.css'),
		target === 'client' ? '' : filterGetImports(plugins.acpScssFiles, '.scss'),
	]);

	async function filterGetImports(files, extension) {
		const filteredFiles = await filterMissingFiles(files);
		return await getImports(filteredFiles, extension);
	}

	let imports = `${cssImports}\n${scssImports}\n${acpScssImports}`;
	imports = buildImports[target](imports, themeData);

	return { paths: paths, imports: imports };
}

CSS.buildBundle = async function (target, fork) {
	if (target === 'client') {
		let files = await fs.promises.readdir(path.join(__dirname, '../../build/public'));
		files = files.filter(f => f.match(/^client.*\.css$/));
		await Promise.all(files.map(f => fs.promises.unlink(path.join(__dirname, '../../build/public', f))));
	}

	const data = await getBundleMetadata(target);
	const minify = process.env.NODE_ENV !== 'development';
	const { ltr, rtl } = await minifier.css.bundle(data.imports, data.paths, minify, fork);

	await Promise.all([
		fs.promises.writeFile(path.join(__dirname, '../../build/public', `${target}.css`), ltr.code),
		fs.promises.writeFile(path.join(__dirname, '../../build/public', `${target}-rtl.css`), rtl.code),
	]);
	return [ltr.code, rtl.code];
};
