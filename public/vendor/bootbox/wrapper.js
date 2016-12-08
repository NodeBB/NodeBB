/* global bootbox */

require(['translator'], function (shim) {
	"use strict";

	var translator = shim.Translator.create();
	var dialog = bootbox.dialog;
	bootbox.dialog = function (options) {
		var translate = [
			translator.translate(options.message),
			options.title && translator.translate(options.title),
		].concat(Object.keys(options.buttons).map(function (key) {
			if (/cancel|confirm|ok/.test(key)) {
				return null;
			}
			return translator.translate(options.buttons[key].label).then(function (label) {
				options.buttons[key].label = label;
			});
		}));

		Promise.all(translate).then(function (translations) {
			options.message = translations[0];
			options.title = translations[1];

			dialog.call(bootbox, options);
		});
	};

	Promise.all([
		translator.translateKey('modules:bootbox.ok', []),
		translator.translateKey('modules:bootbox.cancel', []),
		translator.translateKey('modules:bootbox.confirm', []),
	]).then(function (translations) {
		var lang = shim.getLanguage();
		bootbox.addLocale(lang, {
			OK: translations[0],
			CANCEL: translations[1],
			CONFIRM: translations[2],
		});
		
		bootbox.setLocale(lang);
	});
});

