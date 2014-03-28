"use strict";
/*global templates*/


(function(module) {
	var helpers = {};

	helpers.displayUsersLink = function(config) {
		return (config.isLoggedIn || !config.privateUserInfo);
	};





	if ('undefined' !== typeof window) {
		$(document).ready(module.exports);
	}

	module.exports = function() {
		var templates = templates || require('./templates');

		templates.registerHelper('displayUsersLink', helpers.displayUsersLink);
	};

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);