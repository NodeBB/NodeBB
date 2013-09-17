var utils = require('./../public/src/utils.js'),
	RDB = require('./redis.js'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	winston = require('winston');

(function(Meta) {

	Meta.configs = {
		init: function(callback) {
			Meta.configs.list(function(err, config) {
				if (!err) {
					Meta.config = config;
					callback();
				} else winston.error(err);
			});
		},
		list: function(callback) {
			RDB.hgetall('config', function(err, config) {
				if (!err) {
					config = config || {};
					config.status = 'ok';
					callback(err, config);
				} else {
					callback(new Error('could-not-read-config'));
				}
			});
		},
		get: function(field, callback) {
			RDB.hget('config', field, callback);
		},
		getFields: function(fields, callback) {
			RDB.hmgetObject('config', fields, callback);
		},
		set: function(field, value, callback) {
			RDB.hset('config', field, value, function(err, res) {
				if (callback)
					callback(err, res);
			});
		},
		setOnEmpty: function(field, value, callback) {
			this.get(field, function(err, curValue) {
				if (!curValue) Meta.configs.set(field, value, callback);
				else callback();
			});
		},
		remove: function(field) {
			RDB.hdel('config', field);
		}
	}

	Meta.themes = {
		get: function(callback) {
			var themePath = path.join(__dirname, '../node_modules');
			fs.readdir(themePath, function(err, files) {
				async.filter(files, function(file, next) {
					fs.stat(path.join(themePath, file), function(err, fileStat) {
						if (err) next(false);

						next((fileStat.isDirectory() && file.slice(0, 13) === 'nodebb-theme-'));
					});
				}, function(themes) {
					async.map(themes, function(theme, next) {
						var config = path.join(themePath, theme, 'theme.json');

						if (fs.existsSync(config)) {
							fs.readFile(config, function(err, file) {
								var configObj = JSON.parse(file.toString());
								if (!configObj.screenshot) configObj.screenshot = nconf.get('relative_path') + '/images/themes/default.png';
								next(err, configObj);
							});
						} else next();
					}, function(err, themes) {
						themes = themes.filter(function(theme) {
							return (theme !== undefined);
						});
						callback(null, themes);
					});
				});
			});
		}
	}

	Meta.title = {
		build: function(urlFragment, current_user, callback) {
			var self = this,
				user = require('./user');

			async.parallel({
				title: function(next) {
					self.parseFragment(urlFragment, next);
				},
				notifCount: function(next) {
					user.notifications.getUnreadCount(current_user, next);
				}
			}, function(err, values) {
				var title;

				if (err) title = Meta.config.title || 'NodeBB';
				else title = (values.title ? values.title + ' | ' : '') + (Meta.config.title || 'NodeBB');

				callback(null, title, values.notifCount);
			});
		},
		parseFragment: function(urlFragment, callback) {
			if (urlFragment === '') {
				callback(null, 'Index');
			} else if (urlFragment === 'recent') {
				callback(null, 'Recent Topics');
			} else if (urlFragment === 'unread') {
				callback(null, 'Unread Topics');
			} else if (urlFragment === 'users') {
				callback(null, 'Registered Users');
			} else if (/^category\/\d+\/?/.test(urlFragment)) {
				var cid = urlFragment.match(/category\/(\d+)/)[1];

				require('./categories').getCategoryField(cid, 'name', function(err, name) {
					callback(null, name);
				});
			} else if (/^topic\/\d+\/?/.test(urlFragment)) {
				var tid = urlFragment.match(/topic\/(\d+)/)[1];

				require('./topics').getTopicField(tid, 'title', function(err, title) {
					callback(null, title);
				});
			} else callback(null);
		}
	}


}(exports));