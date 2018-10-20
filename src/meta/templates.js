'use strict';

var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var winston = require('winston');
var async = require('async');
var path = require('path');
var fs = require('fs');
var nconf = require('nconf');
var _ = require('lodash');
var Benchpress = require('benchpressjs');

var plugins = require('../plugins');
var file = require('../file');
var db = require('../database');

var viewsPath = nconf.get('views_dir');

var Templates = module.exports;

function processImports(paths, templatePath, source, callback) {
	var regex = /<!-- IMPORT (.+?) -->/;

	var matches = source.match(regex);

	if (!matches) {
		return callback(null, source);
	}

	var partial = matches[1];
	if (paths[partial] && templatePath !== partial) {
		fs.readFile(paths[partial], 'utf8', function (err, partialSource) {
			if (err) {
				return callback(err);
			}

			source = source.replace(regex, partialSource);
			processImports(paths, templatePath, source, callback);
		});
	} else {
		winston.warn('[meta/templates] Partial not loaded: ' + matches[1]);
		source = source.replace(regex, '');

		processImports(paths, templatePath, source, callback);
	}
}
Templates.processImports = processImports;

var themeNamePattern = /^(@.*?\/)?nodebb-theme-.*$/;

function getTemplateDirs(activePlugins, callback) {
	var pluginTemplates = activePlugins.map(function (id) {
		if (themeNamePattern.test(id)) {
			return nconf.get('theme_templates_path');
		}
		if (!plugins.pluginsData[id]) {
			return '';
		}
		return path.join(__dirname, '../../node_modules/', id, plugins.pluginsData[id].templates || 'templates');
	}).filter(Boolean);

	var themeConfig = require(nconf.get('theme_config'));
	var theme = themeConfig.baseTheme;

	var themePath;
	var themeTemplates = [];
	while (theme) {
		themePath = path.join(nconf.get('themes_path'), theme);
		themeConfig = require(path.join(themePath, 'theme.json'));

		themeTemplates.push(path.join(themePath, themeConfig.templates || 'templates'));
		theme = themeConfig.baseTheme;
	}

	themeTemplates.push(nconf.get('base_templates_path'));
	themeTemplates = _.uniq(themeTemplates.reverse());

	var coreTemplatesPath = nconf.get('core_templates_path');

	var templateDirs = _.uniq([coreTemplatesPath].concat(themeTemplates, pluginTemplates));

	async.filter(templateDirs, file.exists, callback);
}

function getTemplateFiles(dirs, callback) {
	async.waterfall([
		function (cb) {
			async.map(dirs, function (dir, next) {
				file.walk(dir, function (err, files) {
					if (err) { return next(err); }

					files = files.filter(function (path) {
						return path.endsWith('.tpl');
					}).map(function (file) {
						return {
							name: path.relative(dir, file).replace(/\\/g, '/'),
							path: file,
						};
					});
					next(null, files);
				});
			}, cb);
		},
		function (buckets, cb) {
			var dict = {};
			buckets.forEach(function (files) {
				files.forEach(function (file) {
					dict[file.name] = file.path;
				});
			});

			cb(null, dict);
		},
	], callback);
}

function compileTemplate(filename, source, callback) {
	async.waterfall([
		function (next) {
			file.walk(viewsPath, next);
		},
		function (paths, next) {
			paths = _.fromPairs(paths.map(function (p) {
				var relative = path.relative(viewsPath, p).replace(/\\/g, '/');
				return [relative, p];
			}));
			async.waterfall([
				function (next) {
					processImports(paths, filename, source, next);
				},
				function (source, next) {
					Benchpress.precompile(source, {
						minify: global.env !== 'development',
					}, next);
				},
				function (compiled, next) {
					fs.writeFile(path.join(viewsPath, filename.replace(/\.tpl$/, '.js')), compiled, next);
				},
			], next);
		},
	], callback);
}
Templates.compileTemplate = compileTemplate;

function compile(callback) {
	callback = callback || function () {};

	async.waterfall([
		function (next) {
			rimraf(viewsPath, function (err) { next(err); });
		},
		function (next) {
			mkdirp(viewsPath, function (err) { next(err); });
		},
		function (next) {
			db.getSortedSetRange('plugins:active', 0, -1, next);
		},
		getTemplateDirs,
		getTemplateFiles,
		function (files, next) {
			async.each(Object.keys(files), function (name, next) {
				var filePath = files[name];

				async.waterfall([
					function (next) {
						fs.readFile(filePath, 'utf8', next);
					},
					function (source, next) {
						processImports(files, name, source, next);
					},
					function (source, next) {
						mkdirp(path.join(viewsPath, path.dirname(name)), function (err) {
							next(err, source);
						});
					},
					function (imported, next) {
						async.parallel([
							function (cb) {
								fs.writeFile(path.join(viewsPath, name), imported, cb);
							},
							function (cb) {
								Benchpress.precompile(imported, { minify: global.env !== 'development' }, function (err, compiled) {
									if (err) {
										cb(err);
										return;
									}

									fs.writeFile(path.join(viewsPath, name.replace(/\.tpl$/, '.js')), compiled, cb);
								});
							},
						], next);
					},
				], next);
			}, next);
		},
		function (next) {
			winston.verbose('[meta/templates] Successfully compiled templates.');
			next();
		},
	], callback);
}
Templates.compile = compile;
