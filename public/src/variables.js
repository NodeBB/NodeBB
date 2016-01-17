"use strict";
/*global ajaxify*/

(function(ajaxify) {

	ajaxify.variables = {};

	ajaxify.variables.parse = function() {
		var dataEl = $('#ajaxify-data');
		if (dataEl.length) {
			ajaxify.data = JSON.parse(dataEl.text());
			dataEl.remove();
		}
	};
}(ajaxify || {}));
