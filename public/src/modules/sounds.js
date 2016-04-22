"use strict";
/* global app, define, socket, config */

define('sounds', ['buzz'], function(buzz) {
	var	Sounds = {};

	var loadedSounds = {};
	var eventSoundMapping;
	var files;

	socket.on('event:sounds.reloadMapping', function() {
		socket.emit('modules.sounds.getMapping', function(err, mapping) {
			if (err) {
				return app.alertError('[sounds] Could not load sound mapping!');
			}
			eventSoundMapping = mapping;
		});
	});

	function loadData(callback) {
		socket.emit('modules.sounds.getData', function(err, data) {
			if (err) {
				return app.alertError('[sounds] Could not load sound mapping!');
			}
			eventSoundMapping = data.mapping;
			files = data.files;
			callback();
		});
	}

	function isSoundLoaded(fileName) {
		return loadedSounds[fileName];
	}

	function loadFile(fileName, callback) {
		function createSound() {
			if (files && files[fileName]) {
				loadedSounds[fileName] = new buzz.sound(files[fileName]);
			}
			callback();
		}

		if (isSoundLoaded(fileName)) {
			return callback();
		}

		if (!files || !files[fileName]) {
			return loadData(createSound);
		}
		createSound();
	}

	Sounds.play = function(name) {
		function play() {
			Sounds.playFile(eventSoundMapping[name]);
		}

		if (!config.notificationSounds) {
			return;
		}

		if (!eventSoundMapping) {
			return loadData(play);
		}

		play();
	};

	Sounds.playFile = function(fileName) {
		if (!fileName) {
			return;
		}

		function play() {
			if (loadedSounds[fileName]) {
				loadedSounds[fileName].play();
			} else {
				app.alertError('[sounds] Not found: ' + fileName);
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
