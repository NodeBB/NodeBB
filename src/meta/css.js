'use strict';

const winston = require('winston');
const nconf = require('nconf');
const fs = require('fs');
const util = require('util');
const path = require('path');
const rimraf = require('rimraf');

const rimrafAsync = util.promisify(rimraf);

const plugins = require('../plugins');
const db = require('../database');
const file = require('../file');
const minifier = require('./minifier');

const CSS = module.exports;

CSS.supportedSkins = [
	'cerulean', 'cyborg', 'flatly', 'journal', 'lumen', 'paper', 'simplex',
	'spacelab', 'united', 'cosmo', 'darkly', 'readable', 'sandstone',
	'slate', 'superhero', 'yeti',
];

const buildImports = {
	client: function (source) {
		return [
			'@import "bootstrap/scss/bootstrap";',
			'@import "../../public/scss/mixins.scss";',
			'@import "../../public/scss/generics.scss";',
			'@import "../../public/scss/responsive-utilities.scss";',
			'@import "fontawesome";',
			'@import "./theme";',
			source,

			'@import "../../public/scss/jquery-ui.scss";',
			'@import "../node_modules/@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			'@import "../node_modules/cropperjs/dist/cropper";',

			'@import "../../public/scss/flags.scss";',

			'@import "../../public/scss/global.scss";',
			'@import "../../public/scss/modals.scss";',
		].join('\n');
	},
	admin: function (source) {
		return [
			'@import "bootstrap/scss/bootstrap";',
			'@import "../../public/scss/mixins.scss";',
			'@import "../public/scss/generics.scss";',
			'@import "../../public/scss/responsive-utilities.scss";',
			'@import "fontawesome";',
			'@import "../public/scss/admin/admin.scss";',
			source,
			'@import "../../public/scss/jquery-ui.scss";',
			'@import "../node_modules/@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			'@import "../public/vendor/mdl/material";',
		].join('\n');
	},
};

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
	let skinImport = [];
	if (target === 'client') {
		const themeData = await db.getObjectFields('config', ['theme:type', 'theme:id', 'bootswatchSkin']);
		const themeId = (themeData['theme:id'] || 'nodebb-theme-persona');
		const baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla'));
		paths.unshift(baseThemePath);

		themeData.bootswatchSkin = skin || themeData.bootswatchSkin;
		if (themeData && themeData.bootswatchSkin) {
			skinImport.push(`\n@import "./@nodebb/bootswatch/${themeData.bootswatchSkin}/variables.less";`);
			skinImport.push(`\n@import "./@nodebb/bootswatch/${themeData.bootswatchSkin}/bootswatch.less";`);
		}
		skinImport = skinImport.join('');
	}

	const [scssImports, cssImports, acpScssImports] = await Promise.all([
		filterGetImports(plugins.scssFiles, '.scss'),
		filterGetImports(plugins.cssFiles, '.css'),
		target === 'client' ? '' : filterGetImports(plugins.acpScssFiles, '.scss'),
	]);

	async function filterGetImports(files, prefix, extension) {
		const filteredFiles = await filterMissingFiles(files);
		return await getImports(filteredFiles, prefix, extension);
	}

	let imports = `${skinImport}\n${cssImports}\n${scssImports}\n${acpScssImports}`;
	imports = buildImports[target](imports);

	return { paths: paths, imports: imports };
}

CSS.buildBundle = async function (target, fork) {
	if (target === 'client') {
		await rimrafAsync(path.join(__dirname, '../../build/public/client*'));
	}

	const data = await getBundleMetadata(target);
	const minify = process.env.NODE_ENV !== 'development';
	const bundle = await minifier.css.bundle(data.imports, data.paths, minify, fork);

	const filename = `${target}.css`;
	await fs.promises.writeFile(path.join(__dirname, '../../build/public', filename), bundle.code);
	return bundle.code;
};
