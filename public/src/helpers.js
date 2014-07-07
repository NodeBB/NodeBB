"use strict";
/*global templates*/


(function(module) {
	var helpers = {};

	helpers.displayUsersLink = function(config) {
		return (config.isLoggedIn || !config.privateUserInfo);
	};

	helpers.buildMetaTag = function(tag) {
		var name = tag.name ? 'name="' + tag.name + '" ' : '',
			property = tag.property ? 'property="' + tag.property + '" ' : '',
			content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + ' />';
	};

	if ('undefined' !== typeof window) {
		$(document).ready(module.exports);
	}

	module.exports = function() {
		var templates = templates || require('templates.js');

		templates.registerHelper('displayUsersLink', helpers.displayUsersLink);
		templates.registerHelper('buildMetaTag', helpers.buildMetaTag);
	};

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);
