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
	client: function (source, themeData) {
		return [
			'@import "mixins";',
			'@import "generics";',
			'@import "fontawesome";',
			boostrapImport(themeData),
			'@import "responsive-utilities";',
			source,
			'@import "jquery-ui";',
			'@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			'@import "cropperjs/dist/cropper";',
			'@import "flags";',
			'@import "global";',
			'@import "modals";',
		].join('\n');
	},
	admin: function (source) {
		return [
			'@import "bootstrap/scss/bootstrap";',
			'@import "mixins.scss";',
			'@import "generics.scss";',
			'@import "responsive-utilities.scss";',
			'@import "fontawesome";',
			'@import "admin/admin.scss";',
			source,
			'@import "jquery-ui.scss";',
			'@import "@adactive/bootstrap-tagsinput/src/bootstrap-tagsinput";',
			'@import "../public/vendor/mdl/material";',
		].join('\n');
	},
};

function boostrapImport(themeData) {
	const { bootswatchSkin } = themeData;
	return [
		bootswatchSkin ? `@import "bootswatch/dist/${bootswatchSkin}/variables";` : '',
		'@import "./theme";',
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
		const themeId = (themeData['theme:id'] || 'nodebb-theme-persona');
		const baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla'));
		paths.unshift(baseThemePath);

		themeData.bootswatchSkin = skin || themeData.bootswatchSkin;
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

	let imports = `${cssImports}\n${scssImports}\n${acpScssImports}`;
	imports = buildImports[target](imports, themeData);

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
