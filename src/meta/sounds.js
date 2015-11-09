'use strict';

var path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	winston = require('winston'),
	rimraf = require('rimraf'),
	mkdirp = require('mkdirp'),
	async = require('async'),

	plugins = require('../plugins'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.sounds = {};

	Meta.sounds.init = function(callback) {
		if (nconf.get('isPrimary') === 'true') {
			var	soundsPath = path.join(__dirname, '../../public/sounds');

			plugins.fireHook('filter:sounds.get', [], function(err, filePaths) {
				if (err) {
					winston.error('Could not initialise sound files:' + err.message);
					return;
				}

				// Clear the sounds directory
				async.series([
					function(next) {
						rimraf(soundsPath, next);
					},
					function(next) {
						mkdirp(soundsPath, next);
					}
				], function(err) {
					if (err) {
						winston.error('Could not initialise sound files:' + err.message);
						return;
					}

					// Link paths
					async.each(filePaths, function(filePath, next) {
						if (process.platform === 'win32') {
							fs.link(filePath, path.join(soundsPath, path.basename(filePath)), next);
						} else {
							fs.symlink(filePath, path.join(soundsPath, path.basename(filePath)), 'file', next);
						}
					}, function(err) {
						if (!err) {
							winston.verbose('[sounds] Sounds OK');
						} else {
							winston.error('[sounds] Could not initialise sounds: ' + err.message);
						}

						if (typeof callback === 'function') {
							callback();
						}
					});
				});
			});
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.sounds.getFiles = function(callback) {
		// todo: Possibly move these into a bundled module?
		fs.readdir(path.join(__dirname, '../../public/sounds'), function(err, files) {
			var	localList = {};

			if (err) {
				winston.error('Could not get local sound files:' + err.message);
				console.log(err.stack);
				return callback(null, []);
			}

			// Return proper paths
			files.forEach(function(filename) {
				localList[filename] = nconf.get('relative_path') + '/sounds/' + filename;
			});

			callback(null, localList);
		});
	};

	Meta.sounds.getMapping = function(callback) {
		db.getObject('settings:sounds', function(err, sounds) {
			if (err || !sounds) {
				// Send default sounds
				var	defaults = {
						'notification': 'notification.mp3',
						'chat-incoming': 'waterdrop-high.mp3',
						'chat-outgoing': undefined
					};

				return callback(null, defaults);
			}

			callback(null, sounds);
		});
	};
};