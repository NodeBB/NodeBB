"use strict";
/* global app, define, socket, config */

define('sounds', function () {
	var	Sounds = {};

	var fileMap;
	var soundMap;
	var cache = {};

	Sounds.loadMap = function loadMap(callback) {
		socket.emit('modules.sounds.getUserSoundMap', function (err, map) {
			if (err) {
				return app.alertError(err.message);
			}
			soundMap = map;
			if (callback) {
				callback();
			}
		});
	};

	function loadData(callback) {
		var outstanding = 2;
		function after() {
			outstanding -= 1;
			if (outstanding === 0 && callback) {
				callback();
			}
		}
		if (fileMap) {
			outstanding -= 1;
		} else {
			$.getJSON(config.relative_path  + '/assets/sounds/fileMap.json', function (map) {
				fileMap = map;
				after();
			});
		}

		Sounds.loadMap(after);
	}

	Sounds.playSound = function playSound(soundName) {
		if (!soundMap || !fileMap) {
			return loadData(after);
		}

		function after() {
			if (!fileMap[soundName]) {
				return;
			}
			var audio = cache[soundName] = cache[soundName] || new Audio(config.relative_path + '/assets/sounds/' + fileMap[soundName]);
			audio.pause();
 			audio.currentTime = 0;
			audio.play();
		}

		after();
	};

	Sounds.play = function play(type, id) {
		function after() {
			if (!soundMap[type]) {
				return;
			}
			
			if (id) {
				if (localStorage.getItem('sounds.handled:' + id)) {
					return;
				}
				localStorage.setItem('sounds.handled:' + id, true);
			}

			Sounds.playSound(soundMap[type]);
		}

		if (!soundMap || !fileMap) {
			return loadData(after);
		}

		after();
	};

	socket.on('event:sounds.reloadMapping', function () {
		Sounds.loadMap();
	});

	return Sounds;
});
