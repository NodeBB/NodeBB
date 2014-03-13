"use strict";

define(['buzz'], function(buzz) {
	var	Sounds = {};

	Sounds.initialised = false;
	Sounds.loaded = {};
	Sounds.mapping = {};

	Sounds.init = function(callback) {
		var	ready = false,
			onComplete = function() {
				callback();
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

			this.initialised = true;

			callback();
		});
	};

	var	loadMapping = function(callback) {
		socket.emit('modules.sounds.getMapping', function(err, mapping) {
			Sounds.mapping = mapping;
			callback();
		});
	};

	Sounds.play = function(name) {
		var	ready = function() {
				if (Sounds.mapping[name] && Sounds.loaded[Sounds.mapping[name]]) {
					Sounds.loaded[Sounds.mapping[name]].play();
				} else {
					console.log('[sounds] Not found:', name);
				}
			};

		if (!this.initialised) this.init(ready);
		else ready();
	};

	return Sounds;
});