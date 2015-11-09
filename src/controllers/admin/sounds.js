'use strict';

var meta = require('../../meta');

var soundsController = {};

soundsController.get = function(req, res, next) {
	meta.sounds.getFiles(function(err, sounds) {
		sounds = Object.keys(sounds).map(function(name) {
			return {
				name: name
			};
		});

		res.render('admin/general/sounds', {
			sounds: sounds
		});
	});
};

module.exports = soundsController;