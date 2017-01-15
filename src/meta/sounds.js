'use strict';

var path = require('path');
var fs = require('fs');
var nconf = require('nconf');
var winston = require('winston');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var async = require('async');

var plugins = require('../plugins');
var db = require('../database');

module.exports = function (Meta) {

	Meta.sounds = {};

	Meta.sounds.init = function (callback) {
		if (nconf.get('isPrimary') === 'true') {
			setupSounds(callback);
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.sounds.getFiles = function (callback) {
		async.waterfall([
			function (next) {
				fs.readdir(path.join(__dirname, '../../build/public/sounds'), next);
			},
			function (sounds, next) {
				fs.readdir(path.join(__dirname, '../../public/uploads/sounds'), function (err, uploaded) {
					next(err, sounds.concat(uploaded));
				});
			}
		], function (err, files) {
			var	localList = {};

			// Filter out hidden files
			files = files.filter(function (filename) {
				return !filename.startsWith('.');
			});

			if (err) {
				winston.error('Could not get local sound files:' + err.message);
				console.log(err.stack);
				return callback(null, []);
			}

			// Return proper paths
			files.forEach(function (filename) {
				localList[filename] = nconf.get('relative_path') + '/sounds/' + filename;
			});

			callback(null, localList);
		});
	};

	Meta.sounds.getMapping = function (uid, callback) {
		var user = require('../user');
		async.parallel({
			defaultMapping: function (next) {
				db.getObject('settings:sounds', next);
			},
			userSettings: function (next) {
				user.getSettings(uid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var userSettings = results.userSettings;
			var defaultMapping = results.defaultMapping || {};
			var soundMapping = {};
			soundMapping.notification = (userSettings.notificationSound || userSettings.notificationSound === '') ?
				userSettings.notificationSound : defaultMapping.notification || '';

			soundMapping['chat-incoming'] = (userSettings.incomingChatSound || userSettings.incomingChatSound === '') ?
				userSettings.incomingChatSound : defaultMapping['chat-incoming'] || '';

			soundMapping['chat-outgoing'] = (userSettings.outgoingChatSound || userSettings.outgoingChatSound === '') ?
				userSettings.outgoingChatSound : defaultMapping['chat-outgoing'] || '';

			callback(null, soundMapping);
		});
	};

	function setupSounds(callback) {
		var	soundsPath = path.join(__dirname, '../../build/public/sounds');

		async.waterfall([
			function (next) {
				fs.readdir(path.join(__dirname, '../../public/uploads/sounds'), next);
			},
			function (uploaded, next) {
				uploaded = uploaded.filter(function (filename) {
					return !filename.startsWith('.');
				}).map(function (filename) {
					return path.join(__dirname, '../../public/uploads/sounds', filename);
				});

				plugins.fireHook('filter:sounds.get', uploaded, function (err, filePaths) {
					if (err) {
						winston.error('Could not initialise sound files:' + err.message);
						return;
					}

					if (nconf.get('local-assets') === false) {
						// Don't regenerate the public/sounds/ directory. Instead, create a mapping for the router to use
						Meta.sounds._filePathHash = filePaths.reduce(function (hash, filePath) {
							hash[path.basename(filePath)] = filePath;
							return hash;
						}, {});

						winston.verbose('[sounds] Sounds OK');
						if (typeof next === 'function') {
							return next();
						} else {
							return;
						}
					}

					// Clear the sounds directory
					async.series([
						function (next) {
							rimraf(soundsPath, next);
						},
						function (next) {
							mkdirp(soundsPath, next);
						}
					], function (err) {
						if (err) {
							winston.error('Could not initialise sound files:' + err.message);
							return;
						}

						// Link paths
						async.each(filePaths, function (filePath, next) {
							if (process.platform === 'win32') {
								fs.link(filePath, path.join(soundsPath, path.basename(filePath)), next);
							} else {
								fs.symlink(filePath, path.join(soundsPath, path.basename(filePath)), 'file', next);
							}
						}, function (err) {
							if (!err) {
								winston.verbose('[sounds] Sounds OK');
							} else {
								winston.error('[sounds] Could not initialise sounds: ' + err.message);
							}

							if (typeof next === 'function') {
								next();
							}
						});
					});
				});
			}
		], callback);
	}
};