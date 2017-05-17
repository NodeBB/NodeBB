/* global bootbox */

require(['translator'], function (shim) {
	'use strict';

	var translator = shim.Translator.create();
	var dialog = bootbox.dialog;
	var attrsToTranslate = ['placeholder', 'title', 'value'];
	bootbox.dialog = function (options) {
		var show = options.show !== false;
		options.show = false;

		var $elem = dialog.call(bootbox, options);
		var element = $elem[0];

		if (/\[\[.+\]\]/.test(element.outerHTML)) {
			translator.translateInPlace(element, attrsToTranslate).then(function () {
				if (show) {
					$elem.modal('show');
				}
			});
		} else if (show) {
			$elem.modal('show');
		}

		return $elem;
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

