
'use strict';

var nconf = require('nconf');
var winston = require('winston');
var fs = require('fs');
var path = require('path');
var async = require('async');

var file = require('../file');
var db = require('../database');
var Meta = require('../meta');
var events = require('../events');

var Themes = module.exports;

var themeNamePattern = /^(@.*?\/)?nodebb-theme-.*$/;

Themes.get = function (callback) {
	var themePath = nconf.get('themes_path');
	if (typeof themePath !== 'string') {
		return callback(null, []);
	}

	async.waterfall([
		function (next) {
			fs.readdir(themePath, next);
		},
		function (dirs, next) {
			async.map(dirs.filter(function (dir) {
				return themeNamePattern.test(dir) || dir.startsWith('@');
			}), function (dir, next) {
				var dirpath = path.join(themePath, dir);

				fs.stat(dirpath, function (err, stat) {
					if (err) {
						if (err.code === 'ENOENT') {
							return next(null, false);
						}
						return next(err);
					}

					if (!stat.isDirectory()) {
						return next(null, null);
					}

					if (!dir.startsWith('@')) {
						return next(null, dir);
					}

					fs.readdir(dirpath, function (err, themes) {
						if (err) {
							return next(err);
						}

						async.filter(themes.filter(function (theme) {
							return themeNamePattern.test(theme);
						}), function (theme, next) {
							fs.stat(path.join(dirpath, theme), function (err, stat) {
								if (err) {
									if (err.code === 'ENOENT') {
										return next(null, false);
									}
									return next(err);
								}

								next(null, stat.isDirectory());
							});
						}, function (err, themes) {
							if (err) {
								return next(err);
							}

							next(null, themes.map(function (theme) {
								return dir + '/' + theme;
							}));
						});
					});
				});
			}, next);
		},
		function (themes, next) {
			themes = themes.reduce(function (prev, theme) {
				if (!theme) {
					return prev;
				}

				return prev.concat(theme);
			}, []);

			async.map(themes, function (theme, next) {
				var config = path.join(themePath, theme, 'theme.json');

				fs.readFile(config, 'utf8', function (err, file) {
					if (err) {
						if (err.code === 'ENOENT') {
							return next(null, null);
						}
						return next(err);
					}
					try {
						var configObj = JSON.parse(file);

						// Minor adjustments for API output
						configObj.type = 'local';
						if (configObj.screenshot) {
							configObj.screenshot_url = nconf.get('relative_path') + '/css/previews/' + encodeURIComponent(configObj.id);
						} else {
							configObj.screenshot_url = nconf.get('relative_path') + '/assets/images/themes/default.png';
						}
						next(null, configObj);
					} catch (err) {
						winston.error('[themes] Unable to parse theme.json ' + theme);
						next(null, null);
					}
				});
			}, next);
		},
		function (themes, next) {
			themes = themes.filter(Boolean);
			next(null, themes);
		},
	], callback);
};

Themes.set = function (data, callback) {
	var themeData = {
		'theme:type': data.type,
		'theme:id': data.id,
		'theme:staticDir': '',
		'theme:templates': '',
		'theme:src': '',
	};

	switch (data.type) {
	case 'local':
		async.waterfall([
			async.apply(Meta.configs.get, 'theme:id'),
			function (current, next) {
				async.series([
					async.apply(db.sortedSetRemove, 'plugins:active', current),
					async.apply(db.sortedSetAdd, 'plugins:active', 0, data.id),
				], function (err) {
					next(err);
				});
			},
			function (next) {
				fs.readFile(path.join(nconf.get('themes_path'), data.id, 'theme.json'), 'utf8', function (err, config) {
					if (!err) {
						config = JSON.parse(config);
						next(null, config);
					} else {
						next(err);
					}
				});
			},
			function (config, next) {
				themeData['theme:staticDir'] = config.staticDir ? config.staticDir : '';
				themeData['theme:templates'] = config.templates ? config.templates : '';
				themeData['theme:src'] = '';
				themeData.bootswatchSkin = '';

				Meta.configs.setMultiple(themeData, next);

				// Re-set the themes path (for when NodeBB is reloaded)
				Themes.setPath(config);
			},
			function (next) {
				events.log({
					type: 'theme-set',
					uid: parseInt(data.uid, 10) || 0,
					ip: data.ip || '127.0.0.1',
					text: data.id,
				}, next);
			},
		], callback);

		Meta.reloadRequired = true;
		break;

	case 'bootswatch':
		Meta.configs.setMultiple({
			'theme:src': data.src,
			bootswatchSkin: data.id.toLowerCase(),
		}, callback);
		break;
	}
};

Themes.setupPaths = function (callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				themesData: Themes.get,
				currentThemeId: function (next) {
					Meta.configs.get('theme:id', next);
				},
			}, next);
		},
		function (data, next) {
			var themeId = data.currentThemeId || 'nodebb-theme-persona';

			if (process.env.NODE_ENV === 'development') {
				winston.info('[themes] Using theme ' + themeId);
			}

			var themeObj = data.themesData.find(function (themeObj) {
				return themeObj.id === themeId;
			});

			if (!themeObj) {
				return callback(new Error('[[error:theme-not-found]]'));
			}

			Themes.setPath(themeObj);
			next();
		},
	], callback);
};

Themes.setPath = function (themeObj) {
	// Theme's templates path
	var themePath = nconf.get('base_templates_path');
	var fallback = path.join(nconf.get('themes_path'), themeObj.id, 'templates');

	if (themeObj.templates) {
		themePath = path.join(nconf.get('themes_path'), themeObj.id, themeObj.templates);
	} else if (file.existsSync(fallback)) {
		themePath = fallback;
	}

	nconf.set('theme_templates_path', themePath);
	nconf.set('theme_config', path.join(nconf.get('themes_path'), themeObj.id, 'theme.json'));
};
