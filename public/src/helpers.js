"use strict";
/*global templates*/


(function(module) {
	var helpers = {},
		templates = templates || require('./templates');


	helpers.displayUsersLink = function(config) {
		return (config.isLoggedIn && !config.privateUserInfo);
	};





	if ('undefined' !== typeof window) {
		$(document).ready(module.exports);
	}

	module.exports = function() {
		templates.registerHelper('displayUsersLink', helpers.displayUsersLink);
	};

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);