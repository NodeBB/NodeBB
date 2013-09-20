(function (module) {
	"use strict";
	/*global RELATIVE_PATH*/

	var translator = {},
		loaded = {};

	module.exports = translator;


	translator.load = function (file, callback) {
		if (loaded[file]) {
			callback(loaded[file]);
		} else {
			var timestamp = new Date().getTime(); //debug

			jQuery.getJSON(RELATIVE_PATH + '/language/en/' + file + '.json?v=' + timestamp, function (language) {
				loaded[file] = language;
				callback(language);
			});
		}
	};




	translator.translate = function (data, callback) {
		var keys = data.match(/\[\[.*?\]\]/g),
			loading = 0;


		for (var key in keys) {
			if (keys.hasOwnProperty(key)) {
				var parsedKey = keys[key].replace('[[', '').replace(']]', '').split(':'),
					languageFile = parsedKey[0];

				parsedKey = parsedKey[1];

				if (loaded[languageFile]) {
					data = data.replace(keys[key], loaded[file][parsedKey]);
				} else {
					loading++;

					(function (languageKey, parsedKey) {
						translator.load(languageFile, function (languageData) {
							data = data.replace(languageKey, languageData[parsedKey]);
							loading--;
							checkComplete();
						});
					}(keys[key], parsedKey));

				}
			}

			checkComplete();
		}

		function checkComplete() {

			if (loading === 0) {
				callback(data);
			}
		}

	};

	if ('undefined' !== typeof window) {
		window.translator = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);