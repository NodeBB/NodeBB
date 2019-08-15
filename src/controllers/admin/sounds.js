'use strict';

const plugins = require('../../plugins');
const meta = require('../../meta');

const soundsController = module.exports;

soundsController.get = async function (req, res) {
	const types = [
		'notification',
		'chat-incoming',
		'chat-outgoing',
	];
	const settings = await meta.configs.getFields(types) || {};
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
};
