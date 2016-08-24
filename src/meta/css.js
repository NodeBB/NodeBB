'use strict';

var winston = require('winston');
var	nconf = require('nconf');
var	fs = require('fs');
var	path = require('path');
var	async = require('async');
var	autoprefixer = require('autoprefixer');
var	postcss = require('postcss');

var	plugins = require('../plugins');
var	emitter = require('../emitter');
var	db = require('../database');
var	file = require('../file');
var	utils = require('../../public/src/utils');
	
var sass = require('node-sass');

module.exports = function(Meta) {

	Meta.css = {};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;

	Meta.css.minify = function(callback) {
		callback = callback || function() {};
		if (nconf.get('isPrimary') !== 'true') {
			winston.verbose('[meta/css] Cluster worker ' + process.pid + ' skipping LESS/CSS compilation');
			return callback();
		}

		winston.verbose('[meta/css] Minifying SASS/CSS');
		db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
			if (err) {
				return callback(err);
			}

			var themeId = (themeData['theme:id'] || 'nodebb-theme-persona'),
				baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
				paths = [
					baseThemePath,
					path.join(__dirname, '../../node_modules'),
					path.join(__dirname, '../../public/vendor/fontawesome/scss'),
					//path.join(__dirname, '../../public/vendor/bootstrap/less')
				];
				
			var	source = '@import "font-awesome";';
			source += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/mixins.scss";';
			
			source = source + '@import "./theme";\n';
			
			source += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/generics.scss";';

			plugins.lessFiles = filterMissingFiles(plugins.lessFiles);
			plugins.cssFiles = filterMissingFiles(plugins.cssFiles);

			async.waterfall([
				function(next) {
					getStyleSource(plugins.sassFiles, '\n@import ".', '.scss', next);
				},
				function(src, next) {
					source += src;
					getStyleSource(plugins.cssFiles, '\n@import ".', '.css', next);
				},
				function(src, next) {
					source += src;
					next();
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				var acpSource = source;

				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/vendor/colorpicker/colorpicker";';
				
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/flags.scss";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/blacklist.scss";';
				
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/global.scss";';
				
				acpSource += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/admin/admin";';
				acpSource += '\n@import "..' + path.sep + '..' + path.sep + 'public/sass/generics.scss";';
				acpSource += '\n@import "..' + path.sep + '..' + path.sep + 'public/vendor/colorpicker/colorpicker";';


				var fromFile = nconf.get('from-file') || '';
				
				async.series([
					function(next) {
						if (fromFile.match('clientLess')) {
							winston.info('[minifier] Compiling front-end SASS files skipped');
							return Meta.css.getFromFile(path.join(__dirname, '../../public/stylesheet.css'), 'cache', next);
						}

						minify(source, paths, 'cache', next);
					},
					function(next) {
						if (fromFile.match('acpLess')) {
							winston.info('[minifier] Compiling ACP SASS files skipped');
							return Meta.css.getFromFile(path.join(__dirname, '../../public/admin.css'), 'acpCache', next);
						}
						
						minify(acpSource, paths, 'acpCache', next);
					}
				], function(err, minified) {
					if (err) {
						return callback(err);
					}

					// Propagate to other workers
					if (process.send) {
						process.send({
							action: 'css-propagate',
							cache: fromFile.match('clientLess') ? Meta.css.cache : minified[0],
							acpCache: fromFile.match('acpLess') ? Meta.css.acpCache : minified[1]
						});
					}

					emitter.emit('meta:css.compiled');

					callback();
				});
			});
		});
	};

	function getStyleSource(files, prefix, extension, callback) {
		var	pluginDirectories = [],
			source = '';

		files.forEach(function(styleFile) {
			if (styleFile.endsWith(extension)) {
				if (extension === '.css') {
					source += prefix + path.sep + styleFile.slice(0, -4) + '";';
				} else {
					source += prefix + path.sep + styleFile + '";';
				}
			} else {
				pluginDirectories.push(styleFile);
			}
		});

		async.each(pluginDirectories, function(directory, next) {
			utils.walk(directory, function(err, styleFiles) {
				if (err) {
					return next(err);
				}

				styleFiles.forEach(function(styleFile) {
					source += prefix + path.sep + styleFile + '";';
				});

				next();
			});
		}, function(err) {
			callback(err, source);
		});
	}

	Meta.css.commitToFile = function(filename, callback) {
		var file = (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css';

		fs.writeFile(path.join(__dirname, '../../public/' + file), Meta.css[filename], function(err) {
			if (!err) {
				winston.verbose('[meta/css] ' + file + ' committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}

			callback();
		});
	};

	Meta.css.getFromFile = function(filePath, filename, callback) {
		winston.verbose('[meta/css] Reading stylesheet ' + filePath.split('/').pop() + ' from file');

		fs.readFile(filePath, function(err, file) {
			if (err) {
				return callback(err);
			}

			Meta.css[filename] = file;
			callback();
		});
	};

	function minify(source, paths, destination, callback) {
		sass.render({
			data: source,
			includePaths: paths
		}, function(err, sassOutput) { 
			if (err) {
				winston.error('[meta/css] Could not minify SCSS/CSS: ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}
			
			postcss([ autoprefixer ]).process(sassOutput.css).then(function (result) {
				result.warnings().forEach(function (warn) {
					winston.verbose(warn.toString());
				});
			
				Meta.css[destination] = result.css;
				
				if (nconf.get('isPrimary') === 'true' && (nconf.get('local-assets') === undefined || nconf.get('local-assets') !== false)) {
					return Meta.css.commitToFile(destination, function() {
						if (typeof callback === 'function') {
							callback(null, result.css);
						}
					});
				}
	
				if (typeof callback === 'function') {
					callback(null, result.css);
				}
			
			});
		
		});
	}

	function filterMissingFiles(files) {
		return files.filter(function(filePath) {
			var exists = file.existsSync(path.join(__dirname, '../../node_modules', filePath));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + filePath);
			}
			return exists;
		});
	}
};