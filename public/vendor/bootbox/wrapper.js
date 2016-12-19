/* global bootbox */

require(['translator'], function (shim) {
	"use strict";

	function descendantTextNodes(node) {
		var textNodes = [];

		function helper(node) {
			if (node.nodeType === 3) {
				textNodes.push(node);
			} else {
				for (var i = 0, c = node.childNodes, l = c.length; i < l; i += 1) {
					helper(c[i]);
				}
			}
		}

		helper(node);
		return textNodes;
	}

	var translator = shim.Translator.create();
	var dialog = bootbox.dialog;
	bootbox.dialog = function (options) {
		var show, $elem, nodes, text;

		show = options.show !== false;
		options.show = false;

		$elem = dialog.call(bootbox, options);

		if (/\[\[.+\]\]/.test($elem[0].outerHTML)) {
			nodes = descendantTextNodes($elem[0]);
			text = nodes.map(function (node) {
				return node.nodeValue;
			}).join('  ||  ');

			translator.translate(text).then(function (translated) {
				translated.split('  ||  ').forEach(function (html, i) {
					$(nodes[i]).replaceWith(html);
				});
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

