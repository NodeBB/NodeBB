"use strict";
/*global templates*/


(function(module) {
	var helpers = {};

	helpers.displayUsersLink = function(config) {
		return (config.loggedIn || !config.privateUserInfo);
	};

	helpers.buildMetaTag = function(tag) {
		var name = tag.name ? 'name="' + tag.name + '" ' : '',
			property = tag.property ? 'property="' + tag.property + '" ' : '',
			content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + '/>';
	};

	// Groups helpers
	helpers.membershipBtn = function(groupObj) {
		if (groupObj.isMember) {
			return '<button class="btn btn-danger" data-action="leave" data-group="' + groupObj.name + '"><i class="fa fa-times"></i> Leave Group</button>';
		} else {
			if (groupObj.pending) {
				return '<button class="btn btn-warning disabled"><i class="fa fa-clock-o"></i> Invitation Pending</button>';
			} else {
				return '<button class="btn btn-success" data-action="join" data-group="' + groupObj.name + '"><i class="fa fa-plus"></i> Join Group</button>';
			}
		}
	};

	if ('undefined' !== typeof window) {
		$(document).ready(module.exports);
	}

	module.exports = function() {
		var templates = templates || require('templates.js');

		templates.registerHelper('displayUsersLink', helpers.displayUsersLink);
		templates.registerHelper('buildMetaTag', helpers.buildMetaTag);
		templates.registerHelper('membershipBtn', helpers.membershipBtn);
	};

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);
