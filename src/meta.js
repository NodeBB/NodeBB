var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),

	utils = require('./../public/src/utils'),
	db = require('./database'),
	plugins = require('./plugins'),
	User = require('./user');


(function (Meta) {
	Meta.config = {};

	Meta.configs = {
		init: function (callback) {
			delete Meta.config;

			Meta.configs.list(function (err, config) {
				if(err) {
					winston.error(err);
					return callback(err);
				}

				Meta.config = config;
				callback();
			});
		},
		list: function (callback) {
			db.getObject('config', function (err, config) {
				if(err) {
					return callback(err);
				}

				config = config || {};
				config.status = 'ok';
				callback(err, config);
			});
		},
		get: function (field, callback) {
			db.getObjectField('config', field, callback);
		},
		getFields: function (fields, callback) {
			db.getObjectFields('config', fields, callback);
		},
		set: function (field, value, callback) {
			if(!field) {
				return callback(new Error('invalid config field'));
			}

			db.setObjectField('config', field, value, function(err, res) {
				if (callback) {
					if(!err && Meta.config) {
						Meta.config[field] = value;
					}

					callback(err, res);
				}

				// this might be a good spot to add a hook
				if (field === 'defaultLang') {
					var translator = require('../public/src/translator');
					translator.loadServer();
				}
			});
		},
		setOnEmpty: function (field, value, callback) {
			Meta.configs.get(field, function (err, curValue) {
				if(err) {
					return callback(err);
				}

				if (!curValue) {
					Meta.configs.set(field, value, callback);
				} else {
					callback();
				}
			});
		},
		remove: function (field) {
			db.deleteObjectField('config', field);
		}
	};

	Meta.themes = {
		get: function (callback) {
			var themePath = path.join(__dirname, '../node_modules');
			fs.readdir(themePath, function (err, files) {
				async.filter(files, function (file, next) {
					fs.stat(path.join(themePath, file), function (err, fileStat) {
						if (err) {
							return next(false);
						}

						next((fileStat.isDirectory() && file.slice(0, 13) === 'nodebb-theme-'));
					});
				}, function (themes) {
					async.map(themes, function (theme, next) {
						var config = path.join(themePath, theme, 'theme.json');

						if (fs.existsSync(config)) {
							fs.readFile(config, function (err, file) {
								if (err) return next();
								else {
									var configObj = JSON.parse(file.toString());
									next(err, configObj);
								}
							});
						} else {
							next();
						}
					}, function (err, themes) {
						themes = themes.filter(function (theme) {
							return (theme !== undefined);
						});
						callback(null, themes);
					});
				});
			});
		},
		set: function(data, callback) {
			var	themeData = {
					'theme:type': data.type,
					'theme:id': data.id,
					'theme:staticDir': '',
					'theme:templates': '',
					'theme:src': ''
				};

			switch(data.type) {
				case 'local':
					async.waterfall([
						function(next) {
							fs.readFile(path.join(__dirname, '../node_modules', data.id, 'theme.json'), function(err, config) {
								if (!err) {
									config = JSON.parse(config.toString());
									next(null, config);
								} else {
									next(err);
								}
							});
						},
						function(config, next) {
							themeData['theme:staticDir'] = config.staticDir ? config.staticDir : '';
							themeData['theme:templates'] = config.templates ? config.templates : '';
							themeData['theme:src'] = config.frameworkCSS ? config.frameworkCSS : '';

							db.setObject('config', themeData, next);
						}
					], function(err) {
						callback(err);
					});
				break;

				case 'bootswatch':
					themeData['theme:src'] = data.src;
					db.setObject('config', themeData, callback);
				break;
			}
		}
	};

	Meta.title = {
		tests: {
			isCategory: /^category\/\d+\/?/,
			isTopic: /^topic\/\d+\/?/,
			isUserPage: /^user\/[^\/]+(\/[\w]+)?/
		},
		build: function (urlFragment, callback) {
			var user = require('./user');

			Meta.title.parseFragment(decodeURIComponent(urlFragment), function(err, title) {
				var title;

				if (err) {
					title = Meta.config.browserTitle || 'NodeBB';
				} else {
					title = (title ? title + ' | ' : '') + (Meta.config.browserTitle || 'NodeBB');
				}

				callback(null, title);
			});
		},
		parseFragment: function (urlFragment, callback) {
			var	translated = ['', 'recent', 'unread', 'users', 'notifications'];
			if (translated.indexOf(urlFragment) !== -1) {
				if (!urlFragment.length) {
					urlFragment = 'home';
				}

				translator.translate('[[pages:' + urlFragment + ']]', function(translated) {
					callback(null, translated);
				});
			} else if (this.tests.isCategory.test(urlFragment)) {
				var cid = urlFragment.match(/category\/(\d+)/)[1];

				require('./categories').getCategoryField(cid, 'name', function (err, name) {
					callback(null, name);
				});
			} else if (this.tests.isTopic.test(urlFragment)) {
				var tid = urlFragment.match(/topic\/(\d+)/)[1];

				require('./topics').getTopicField(tid, 'title', function (err, title) {
					callback(null, title);
				});
			} else if (this.tests.isUserPage.test(urlFragment)) {
				var	matches = urlFragment.match(/user\/([^\/]+)\/?([\w]+)?/),
					userslug = matches[1],
					subpage = matches[2];

				User.getUsernameByUserslug(userslug, function(err, username) {
					if (subpage) {
						translator.translate('[[pages:user.' + subpage + ', ' + username + ']]', function(translated) {
							callback(null, translated);
						})
					} else {
						callback(null, username);
					}
				});
			} else {
				callback(null);
			}
		}
	};

	Meta.js = {
		scripts: [
			'vendor/jquery/js/jquery.js',
			'vendor/jquery/js/jquery-ui-1.10.4.custom.js',
			'vendor/jquery/timeago/jquery.timeago.js',
			'vendor/jquery/js/jquery.form.js',
			'vendor/bootstrap/js/bootstrap.min.js',
			'vendor/requirejs/require.js',
			'vendor/bootbox/bootbox.min.js',
			'vendor/tinycon/tinycon.js',
			'vendor/xregexp/xregexp.js',
			'vendor/xregexp/unicode/unicode-base.js',
			'src/app.js',
			'src/templates.js',
			'src/ajaxify.js',
			'src/translator.js',
			'src/utils.js'
		],
		minFile: path.join(__dirname, '..', 'public/src/nodebb.min.js'),
		get: function (callback) {
			plugins.fireHook('filter:scripts.get', this.scripts, function(err, scripts) {
				var mtime,
					jsPaths = scripts.map(function (jsPath) {
						if (jsPath.substring(0, 7) === 'plugins') {
							var paths = jsPath.split('/'),
								mappedPath = paths[1];

							if (plugins.staticDirs[mappedPath]) {
								jsPath = jsPath.replace(path.join('plugins', mappedPath), '');
								return path.join(plugins.staticDirs[mappedPath], jsPath);
							} else {
								winston.warn('[meta.scripts.get] Could not resolve mapped path: ' + mappedPath + '. Are you sure it is defined by a plugin?');
								return null;
							}
						} else {
							return path.join(__dirname, '..', '/public', jsPath);
						}
					});

				Meta.js.scripts = jsPaths.filter(function(path) { return path !== null });

				if (process.env.NODE_ENV !== 'development') {
					async.parallel({
						mtime: function (next) {
							async.map(jsPaths, fs.stat, function (err, stats) {
								async.reduce(stats, 0, function (memo, item, next) {
									if(item) {
										mtime = +new Date(item.mtime);
										next(null, mtime > memo ? mtime : memo);
									} else {
										next(null, memo);
									}
								}, next);
							});
						},
						minFile: function (next) {
							if (!fs.existsSync(Meta.js.minFile)) {
								winston.info('No minified client-side library found');
								return next(null, 0);
							}

							fs.stat(Meta.js.minFile, function (err, stat) {
								next(err, +new Date(stat.mtime));
							});
						}
					}, function (err, results) {
						if (results.minFile > results.mtime) {
							winston.info('No changes to client-side libraries -- skipping minification');
							callback(null, [path.relative(path.join(__dirname, '../public'), Meta.js.minFile)]);
						} else {
							Meta.js.minify(function () {
								callback(null, [
									path.relative(path.join(__dirname, '../public'), Meta.js.minFile)
								]);
							});
						}
					});
				} else {
					callback(null, scripts);
				}
			});
		},
		minify: function (callback) {
			var uglifyjs = require('uglify-js'),
				jsPaths = this.scripts,
				minified;

			if (process.env.NODE_ENV === 'development') {
				winston.info('Minifying client-side libraries');
			}

			minified = uglifyjs.minify(jsPaths);
			fs.writeFile(Meta.js.minFile, minified.code, function (err) {
				if (!err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('Minified client-side libraries');
					}
					callback();
				} else {
					winston.error('Problem minifying client-side libraries, exiting.');
					process.exit();
				}
			});
		}
	};

	Meta.db = {
		getFile: function (callback) {
			db.getFileName(callback);
		}
	};
}(exports));
