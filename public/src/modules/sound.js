"use strict";

define(['buzz'], function(buzz) {
	var	Sound = {};

	Sound.initialised = false;
	Sound.loaded = {};

	Sound.init = function(callback) {
		var	sounds = {
			notification: RELATIVE_PATH + '/sound/notification.wav',
			'chat-outgoing': RELATIVE_PATH + '/sound/chat-outgoing.wav',
			'chat-incoming': RELATIVE_PATH + '/sound/chat-incoming.wav'
		};

		for(var name in sounds) {
			if (sounds.hasOwnProperty(name)) {
				var	path = sounds[name];

				Sound.loaded[name] = new buzz.sound(path);
			}
		}

		this.initialised = true;

		callback();
	};

	Sound.play = function(name) {
		var	ready = function() {
				if (Sound.loaded[name]) {
					Sound.loaded[name].play();
				} else {
					console.log('[sound] Not found:', name);
				}
			};

		if (!this.initialised) this.init(ready);
		else ready();
	};

	return Sound;
});