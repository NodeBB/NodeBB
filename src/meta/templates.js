'use strict';

const { mkdirp } = require('mkdirp');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const nconf = require('nconf');
const _ = require('lodash');
const Benchpress = require('benchpressjs');

const plugins = require('../plugins');
const file = require('../file');
const { themeNamePattern, paths } = require('../constants');

const viewsPath = nconf.get('views_dir');

const Templates = module.exports;

async function processImports(paths, templatePath, source) {
	const regex = /<!-- IMPORT (.+?) -->/;

	const matches = source.match(regex);

	if (!matches) {
		return source;
	}

	const partial = matches[1];
	if (paths[partial] && templatePath !== partial) {
		const partialSource = await fs.promises.readFile(paths[partial], 'utf8');
		source = source.replace(regex, partialSource);
		return await processImports(paths, templatePath, source);
	}

	winston.warn(`[meta/templates] Partial not loaded: ${matches[1]}`);
	source = source.replace(regex, '');

	return await processImports(paths, templatePath, source);
}
Templates.processImports = processImports;

async function getTemplateDirs(activePlugins) {
	const pluginTemplates = activePlugins.map((id) => {
		if (themeNamePattern.test(id)) {
			return nconf.get('theme_templates_path');
		}
		if (!plugins.pluginsData[id]) {
			return '';
		}
		return path.join(paths.nodeModules, id, plugins.pluginsData[id].templates || 'templates');
	}).filter(Boolean);

	let themeConfig = require(nconf.get('theme_config'));
	let theme = themeConfig.baseTheme;

	let themePath;
	let themeTemplates = [];
	while (theme) {
		themePath = path.join(nconf.get('themes_path'), theme);
		themeConfig = require(path.join(themePath, 'theme.json'));

		themeTemplates.push(path.join(themePath, themeConfig.templates || 'templates'));
		theme = themeConfig.baseTheme;
	}

	themeTemplates = _.uniq(themeTemplates.reverse());

	const coreTemplatesPath = nconf.get('core_templates_path');

	let templateDirs = _.uniq([coreTemplatesPath].concat(themeTemplates, pluginTemplates));

	templateDirs = await Promise.all(templateDirs.map(async path => (await file.exists(path) ? path : false)));
	return templateDirs.filter(Boolean);
}

async function getTemplateFiles(dirs) {
	const buckets = await Promise.all(dirs.map(async (dir) => {
		let files = await file.walk(dir);
		files = files.filter(path => path.endsWith('.tpl')).map(file => ({
			name: path.relative(dir, file).replace(/\\/g, '/'),
			path: file,
		}));
		return files;
	}));

	const dict = {};
	buckets.forEach((files) => {
		files.forEach((file) => {
			dict[file.name] = file.path;
		});
	});

	return dict;
}

async function compileTemplate(filename, source) {
	let paths = await file.walk(viewsPath);
	paths = _.fromPairs(paths.map((p) => {
		const relative = path.relative(viewsPath, p).replace(/\\/g, '/');
		return [relative, p];
	}));

	source = await processImports(paths, filename, source);
	const compiled = await Benchpress.precompile(source, { filename });
	return await fs.promises.writeFile(path.join(viewsPath, filename.replace(/\.tpl$/, '.js')), compiled);
}
Templates.compileTemplate = compileTemplate;

async function compile() {
	await fs.promises.rm(viewsPath, { recursive: true, force: true });
	await mkdirp(viewsPath);

	let files = await plugins.getActive();
	files = await getTemplateDirs(files);
	files = await getTemplateFiles(files);
	const minify = process.env.NODE_ENV !== 'development';
	await Promise.all(Object.keys(files).map(async (name) => {
		const filePath = files[name];
		let imported = await fs.promises.readFile(filePath, 'utf8');
		imported = await processImports(files, name, imported);

		await mkdirp(path.join(viewsPath, path.dirname(name)));

		// remove empty lines and whitespace
		if (minify) {
			imported = imported.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
		}

		await fs.promises.writeFile(path.join(viewsPath, name), imported);
		const compiled = await Benchpress.precompile(imported, { filename: name });
		await fs.promises.writeFile(path.join(viewsPath, name.replace(/\.tpl$/, '.js')), compiled);
	}));

	winston.verbose('[meta/templates] Successfully compiled templates.');
}
Templates.compile = compile;
