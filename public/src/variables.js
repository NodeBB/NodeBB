"use strict";
/*global ajaxify*/

(function(ajaxify) {
	var parsedVariables = {};

	ajaxify.variables = {};

	ajaxify.variables.set = function(key, value) {
		parsedVariables[key] = value;
	};

	ajaxify.variables.get = function(key) {
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
	};
}(ajaxify || {}));