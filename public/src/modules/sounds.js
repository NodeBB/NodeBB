'use strict';


define('sounds', ['storage'], function (storage) {
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
			$.getJSON(config.relative_path + '/assets/sounds/fileMap.json', function (map) {
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
			var audio = cache[soundName] || new Audio(config.relative_path + '/assets/sounds/' + fileMap[soundName]);
			cache[soundName] = audio;
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
				var item = 'sounds.handled:' + id;
				if (storage.getItem(item)) {
					return;
				}
				storage.setItem(item, true);

				setTimeout(function () {
					storage.removeItem(item);
				}, 5000);
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
