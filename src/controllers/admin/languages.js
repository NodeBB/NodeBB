'use strict';

const languages = require('../../languages');
const meta = require('../../meta');

const languagesController = module.exports;

languagesController.get = async function (req, res) {
	const languageData = await languages.list();
	languageData.forEach(function (language) {
		language.selected = language.code === meta.config.defaultLang;
	});

	res.render('admin/general/languages', {
		languages: languageData,
		autoDetectLang: meta.config.autoDetectLang,
	});
};
