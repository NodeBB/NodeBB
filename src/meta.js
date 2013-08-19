var utils = require('./../public/src/utils.js'),
	RDB = require('./redis.js'),
	async = require('async'),
	path = require('path'),
	fs = require('fs');

(function(Meta) {
	Meta.config = {
		get: function(callback) {
			RDB.hgetall('config', function(err, config) {
				if (!err) {
					config = config || {};
					config.status = 'ok';
					callback(config);
				} else {
					callback({
						status: 'error'
					});
				}
			});
		},
		getFields: function(fields, callback) {
			RDB.hmgetObject('config', fields, callback);
		},
		set: function(field, value, callback) {
			RDB.hset('config', field, value, function(err, res) {
				if(callback)
					callback(err, res);
			});
		},
		remove: function(field) {
			RDB.hdel('config', field);
		}
	}

	Meta.themes = {
		get: function(callback) {
			var	themePath = path.join(__dirname, '../', 'public/themes');
			fs.readdir(themePath, function(err, files) {
				var themeArr = [];
				async.each(files, function(file, next) {
					fs.lstat(path.join(themePath, file), function(err, stats) {
						if(stats.isDirectory()) {
							var	themeDir = file,
								themeConfPath = path.join(themePath, themeDir, 'theme.json');

							fs.exists(themeConfPath, function(exists) {
								if (exists) {
									fs.readFile(themeConfPath, function(err, conf) {
										conf = JSON.parse(conf);
										conf.src = nconf.get('url') + 'themes/' + themeDir + '/' + conf.src;
										if (conf.screenshot) conf.screenshot = nconf.get('url') + 'themes/' + themeDir + '/' + conf.screenshot;
										else conf.screenshot = nconf.get('url') + 'images/themes/default.png';
										themeArr.push(conf);
										next();
									});
								} else next();
							});
						} else next();
					});
				}, function(err) {
					callback(err, themeArr);
				});
			});
		}
	}

	Meta.title = {
		build: function(urlFragment, current_user, callback) {
			var	self = this,
				user = require('./user');

			async.parallel({
				title: function(next) {
					self.parseFragment(urlFragment, next);
				},
				notifCount: function(next) {
					user.notifications.getUnreadCount(current_user, next);
				}
			}, function(err, values) {
				var	title;

				if (err) title = global.config.title || 'NodeBB';
				else title = (values.notifCount > 0 ? '(' + values.notifCount + ') ' : '') + (values.title ? values.title + ' | ' : '') + (global.config.title || 'NodeBB');

				callback(null, title);
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
				var	cid = urlFragment.match(/category\/(\d+)/)[1];

				require('./categories').getCategoryField(cid, 'name', function(err, name) {
					callback(null, name);
				});
			} else if (/^topic\/\d+\/?/.test(urlFragment)) {
				var	tid = urlFragment.match(/topic\/(\d+)/)[1];

				require('./topics').getTopicField(tid, 'title', function(err, title) {
					callback(null, title);
				});
			} else callback(null);
		}
	}
}(exports));