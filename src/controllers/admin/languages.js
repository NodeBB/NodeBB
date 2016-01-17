'use strict';

var languages = require('../../languages');
var meta = require('../../meta');

var languagesController = {};


languagesController.get = function(req, res, next) {
	languages.list(function(err, languages) {
		if (err) {
			return next(err);
		}

		languages.forEach(function(language) {
			language.selected = language.code === (meta.config.defaultLang || 'en_GB');
		});

		res.render('admin/general/languages', {
			languages: languages
		});
	});
};

module.exports = languagesController;