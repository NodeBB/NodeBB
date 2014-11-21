"use strict";
/* global define, socket, config */

define('sounds', ['buzz'], function(buzz) {
	var	Sounds = {};

	var loadedSounds = {};
	var eventSoundMapping = {};
	var files = {};

	loadFiles();

	loadMapping();

	socket.on('event:sounds.reloadMapping', loadMapping);

	function loadFiles() {
		socket.emit('modules.sounds.getSounds', function(err, sounds) {
			if (err) {
				return console.log('[sounds] Could not initialise!');
			}

			files = sounds;
		});
	}

	function loadMapping() {
		socket.emit('modules.sounds.getMapping', function(err, mapping) {
			if (err) {
				return console.log('[sounds] Could not load sound mapping!');
			}
			eventSoundMapping = mapping;
		});
	}

	function isSoundLoaded(fileName) {
		return loadedSounds[fileName];
	}

	function loadFile(fileName, callback) {
		if (isSoundLoaded(fileName)) {
			return callback();
		}

		if (files && files[fileName]) {
			loadedSounds[fileName] = new buzz.sound(files[fileName]);
		}
		callback();
	}

	Sounds.play = function(name) {
		if (!config.notificationSounds) {
			return;
		}

		Sounds.playFile(eventSoundMapping[name]);
	};

	Sounds.playFile = function(fileName) {
		if (!fileName) return;

		function play() {
			if (loadedSounds[fileName]) {
				loadedSounds[fileName].play();
			} else {
				console.log('[sounds] Not found:', fileName);
			}
		}

		if (isSoundLoaded(fileName)) {
			play();
		} else {
			loadFile(fileName, play);
		}
	};

	return Sounds;
});
