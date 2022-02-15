'use strict';

const factory = require('./translator.common');

define('translator', ['jquery', 'utils'], function (jQuery, utils) {
	function loadClient(language, namespace) {
		return new Promise(function (resolve, reject) {
			jQuery.getJSON([config.assetBaseUrl, 'language', language, namespace].join('/') + '.json?' + config['cache-buster'], function (data) {
				const payload = {
					language: language,
					namespace: namespace,
					data: data,
				};
				require(['hooks'], function (hooks) {
					hooks.fire('action:translator.loadClient', payload);
					resolve(payload.promise ? Promise.resolve(payload.promise) : data);
				});
			}).fail(function (jqxhr, textStatus, error) {
				reject(new Error(textStatus + ', ' + error));
			});
		});
	}
	const warn = function () { console.warn.apply(console, arguments); };
	return factory(utils, loadClient, warn);
});
