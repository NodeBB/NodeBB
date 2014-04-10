"use strict";
/* global define, socket */

define(['buzz'], function(buzz) {
	var	Sounds = {};

	Sounds.initialised = false;
	Sounds.loaded = {};
	Sounds.mapping = {};

	Sounds.init = function(callback) {
		var	ready = false,
			onComplete = function() {
				Sounds.initialised = true;
				if (typeof callback === 'function') {
					callback();
				}
			};

		loadFiles(function() {
			if (ready) {
				onComplete();
			} else {
				ready = true;
			}
		});

		loadMapping(function() {
			if (ready) {
				onComplete();
			} else {
				ready = true;
			}
		});

		// Listen for reload message
		socket.on('event:sounds.reloadMapping', function() {
			loadMapping();
		});
	};

	var	loadFiles = function(callback) {
		socket.emit('modules.sounds.getSounds', function(err, sounds) {
			if (err) {
				return console.log('[sounds] Could not initialise!');
			}

			for(var name in sounds) {
				if (sounds.hasOwnProperty(name)) {
					var	path = sounds[name];

					Sounds.loaded[name] = new buzz.sound(path);
				}
			}

			callback();
		});
	};

	var	loadMapping = function(callback) {
		socket.emit('modules.sounds.getMapping', function(err, mapping) {
			Sounds.mapping = mapping;
			if (typeof callback === 'function') {
				callback();
			}
		});
	};

	Sounds.play = function(name) {
		if (!config.notificationSounds) {
			return;
		}
		var	ready = function() {
				if (Sounds.mapping[name] && Sounds.loaded[Sounds.mapping[name]]) {
					Sounds.loaded[Sounds.mapping[name]].play();
				} else {
					console.log('[sounds] Not found:', name);
				}
			};

		if (!this.initialised) {
			this.init(ready);
		} else {
			ready();
		}
	};

	Sounds.playFile = function(fileName) {
		var	ready = function() {
				if (Sounds.loaded[fileName]) {
					Sounds.loaded[fileName].play();
				} else {
					console.log('[sounds] Not found:', name);
				}
			};

		if (!this.initialised) {
			this.init(ready);
		} else {
			ready();
		}
	};

	Sounds.init();
	return Sounds;
});
