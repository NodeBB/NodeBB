'use strict';

var plugins = require('../../plugins');
var meta = require('../../meta');

var soundsController = {};

soundsController.get = function (req, res, next) {
	var types = [
		'notification',
		'chat-incoming',
		'chat-outgoing',
	];
	meta.configs.getFields(types, function (err, settings) {
		if (err) {
			return next(err);
		}

		settings = settings || {};

		var output = {};

		types.forEach(function (type) {
			var soundpacks = plugins.soundpacks.map(function (pack) {
				var sounds = Object.keys(pack.sounds).map(function (soundName) {
					var value = pack.name + ' | ' + soundName;
					return {
						name: soundName,
						value: value,
						selected: value === settings[type],
					};
				});

				return {
					name: pack.name,
					sounds: sounds,
				};
			});

			output[type + '-sound'] = soundpacks;
		});

		res.render('admin/general/sounds', output);
	});
};

module.exports = soundsController;
