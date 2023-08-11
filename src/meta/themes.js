'use strict';

const path = require('path');
const nconf = require('nconf');
const winston = require('winston');
const _ = require('lodash');
const fs = require('fs');

const file = require('../file');
const db = require('../database');
const Meta = require('./index');
const events = require('../events');
const utils = require('../utils');
const { themeNamePattern } = require('../constants');

const Themes = module.exports;

Themes.get = async () => {
	const themePath = nconf.get('themes_path');
	if (typeof themePath !== 'string') {
		return [];
	}

	let themes = await getThemes(themePath);
	themes = _.flatten(themes).filter(Boolean);
	themes = await Promise.all(themes.map(async (theme) => {
		const config = path.join(themePath, theme, 'theme.json');
		const pack = path.join(themePath, theme, 'package.json');
		try {
			const [configFile, packageFile] = await Promise.all([
				fs.promises.readFile(config, 'utf8'),
				fs.promises.readFile(pack, 'utf8'),
			]);
			const configObj = JSON.parse(configFile);
			const packageObj = JSON.parse(packageFile);

			configObj.id = packageObj.name;

			// Minor adjustments for API output
			configObj.type = 'local';
			if (configObj.screenshot) {
				configObj.screenshot_url = `${nconf.get('relative_path')}/css/previews/${encodeURIComponent(configObj.id)}`;
			} else {
				configObj.screenshot_url = `${nconf.get('relative_path')}/assets/images/themes/default.png`;
			}

			return configObj;
		} catch (err) {
			if (err.code === 'ENOENT') {
				return false;
			}

			winston.error(`[themes] Unable to parse theme.json ${theme}`);
			return false;
		}
	}));

	return themes.filter(Boolean);
};

async function getThemes(themePath) {
	let dirs = await fs.promises.readdir(themePath);
	dirs = dirs.filter(dir => themeNamePattern.test(dir) || dir.startsWith('@'));
	return await Promise.all(dirs.map(async (dir) => {
		try {
			const dirpath = path.join(themePath, dir);
			const stat = await fs.promises.stat(dirpath);
			if (!stat.isDirectory()) {
				return false;
			}

			if (!dir.startsWith('@')) {
				return dir;
			}

			const themes = await getThemes(path.join(themePath, dir));
			return themes.map(theme => path.join(dir, theme));
		} catch (err) {
			if (err.code === 'ENOENT') {
				return false;
			}

			throw err;
		}
	}));
}

Themes.set = async (data) => {
	switch (data.type) {
		case 'local': {
			const current = await Meta.configs.get('theme:id');
			const score = await db.sortedSetScore('plugins:active', current);
			await db.sortedSetRemove('plugins:active', current);
			await db.sortedSetAdd('plugins:active', score || 0, data.id);

			if (current !== data.id) {
				const pathToThemeJson = path.join(nconf.get('themes_path'), data.id, 'theme.json');
				if (!pathToThemeJson.startsWith(nconf.get('themes_path'))) {
					throw new Error('[[error:invalid-theme-id]]');
				}

				let config = await fs.promises.readFile(pathToThemeJson, 'utf8');
				config = JSON.parse(config);
				const activePluginsConfig = nconf.get('plugins:active');
				if (!activePluginsConfig) {
					const score = await db.sortedSetScore('plugins:active', current);
					await db.sortedSetRemove('plugins:active', current);
					await db.sortedSetAdd('plugins:active', score || 0, data.id);
				} else if (!activePluginsConfig.includes(data.id)) {
					// This prevents changing theme when configuration doesn't include it, but allows it otherwise
					winston.error(`When defining active plugins in configuration, changing themes requires adding the theme '${data.id}' to the list of active plugins before updating it in the ACP`);
					throw new Error('[[error:theme-not-set-in-configuration]]');
				}

				// Re-set the themes path (for when NodeBB is reloaded)
				Themes.setPath(config);

				await Meta.configs.setMultiple({
					'theme:type': data.type,
					'theme:id': data.id,
					'theme:staticDir': config.staticDir ? config.staticDir : '',
					'theme:templates': config.templates ? config.templates : '',
					'theme:src': '',
					bootswatchSkin: '',
				});

				await events.log({
					type: 'theme-set',
					uid: parseInt(data.uid, 10) || 0,
					ip: data.ip || '127.0.0.1',
					text: data.id,
				});

				Meta.reloadRequired = true;
			}
			break;
		}
		case 'bootswatch':
			await Meta.configs.setMultiple({
				'theme:src': data.src,
				bootswatchSkin: data.id.toLowerCase(),
			});
			break;
	}
};

Themes.setupPaths = async () => {
	const data = await utils.promiseParallel({
		themesData: Themes.get(),
		currentThemeId: Meta.configs.get('theme:id'),
	});

	const themeId = data.currentThemeId || 'nodebb-theme-harmony';

	if (process.env.NODE_ENV === 'development') {
		winston.info(`[themes] Using theme ${themeId}`);
	}

	const themeObj = data.themesData.find(themeObj => themeObj.id === themeId);

	if (!themeObj) {
		throw new Error('theme-not-found');
	}

	Themes.setPath(themeObj);
};

Themes.setPath = function (themeObj) {
	// Theme's templates path
	let themePath;
	const fallback = path.join(nconf.get('themes_path'), themeObj.id, 'templates');

	if (themeObj.templates) {
		themePath = path.join(nconf.get('themes_path'), themeObj.id, themeObj.templates);
	} else if (file.existsSync(fallback)) {
		themePath = fallback;
	} else {
		winston.error('[themes] Unable to resolve this theme\'s templates. Expected to be at "templates/" or defined in the "templates" property of "theme.json"');
		throw new Error('theme-missing-templates');
	}

	nconf.set('theme_templates_path', themePath);
	nconf.set('theme_config', path.join(nconf.get('themes_path'), themeObj.id, 'theme.json'));
};
