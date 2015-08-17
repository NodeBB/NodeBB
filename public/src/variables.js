"use strict";
/*global ajaxify*/

(function(ajaxify) {
	var parsedVariables = {};

	ajaxify.variables = {};

	ajaxify.variables.set = function(key, value) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[deprecated] variables.set is deprecated, please use ajaxify.data, key=' + key);
		}
		parsedVariables[key] = value;
	};

	ajaxify.variables.get = function(key) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('[deprecated] variables.get is deprecated, please use ajaxify.data, key=' + key);
		}
		return parsedVariables[key];
	};

	ajaxify.variables.flush = function() {
		parsedVariables = {};
	};

	ajaxify.variables.parse = function() {
		$('#content [template-variable]').each(function(index, element) {
			var value = null;

			switch ($(element).attr('template-type')) {
			case 'boolean':
				value = ($(element).val() === 'true' || $(element).val() === '1') ? true : false;
				break;
			case 'int':
			case 'integer':
				value = parseInt($(element).val(), 10);
				break;
			default:
				value = $(element).val();
				break;
			}

			ajaxify.variables.set($(element).attr('template-variable'), value);
		});
		var dataEl = $('#content [ajaxify-data]');
		if (dataEl.length) {
			ajaxify.data = JSON.parse(decodeURIComponent(dataEl.attr('ajaxify-data')));
		}
	};
}(ajaxify || {}));
