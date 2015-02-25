;(function(exports) {
	"use strict";
	/* globals define */

	// export the class if we are in a Node-like system.
	if (typeof module === 'object' && module.exports === exports) {
		exports = module.exports/* = SemVer*/;
	}

	var helpers = {};

	helpers.displayUsersLink = function(config) {
		return (config.loggedIn || !config.privateUserInfo);
	};

	helpers.displayMenuItem = function(data, index) {
		var item = data.navigation[index],
			properties = item.properties;

		if (properties) {
			if (properties.loggedIn && !data.loggedIn ||
				properties.adminOnly && !data.isAdmin ||
				properties.installed && properties.installed.search && !data.searchEnabled ||
				properties.hideIfPrivate && data.privateUserInfo) {
				return false;
			}
		}

		return true;
	};

	helpers.buildMetaTag = function(tag) {
		var name = tag.name ? 'name="' + tag.name + '" ' : '',
			property = tag.property ? 'property="' + tag.property + '" ' : '',
			content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + '/>';
	};

	helpers.stringify = function(obj) {
		// Turns the incoming object into a JSON string
		return JSON.stringify(obj).replace(/&/gm,"&amp;").replace(/</gm,"&lt;").replace(/>/gm,"&gt;").replace(/"/g, '&quot;');
	};

	// Groups helpers
	helpers.membershipBtn = function(groupObj) {
		if (groupObj.isMember) {
			return '<button class="btn btn-danger" data-action="leave" data-group="' + groupObj.name + '"><i class="fa fa-times"></i> Leave Group</button>';
		} else {
			if (groupObj.isPending) {
				return '<button class="btn btn-warning disabled"><i class="fa fa-clock-o"></i> Invitation Pending</button>';
			} else if (groupObj.isInvited) {
				return '<button class="btn btn-link" data-action="rejectInvite" data-group="' + groupObj.name + '">Reject</button><button class="btn btn-success" data-action="acceptInvite" data-group="' + groupObj.name + '"><i class="fa fa-plus"></i> Accept Invitation</button>';
			} else {
				return '<button class="btn btn-success" data-action="join" data-group="' + groupObj.name + '"><i class="fa fa-plus"></i> Join Group</button>';
			}
		}
	};

	exports.register = function() {
		var templates;

		if (typeof module === 'object') {
			templates = require('templates.js');
		} else {
			templates = window.templates;
		}

		Object.keys(helpers).forEach(function(helperName) {
			templates.registerHelper(helperName, helpers[helperName]);
		});
	};

	// Use the define() function if we're in AMD land
	if (typeof define === 'function' && define.amd) {
	  define('helpers', exports);
	}

})(
	typeof exports === 'object' ? exports :
	typeof define === 'function' && define.amd ? {} :
	helpers = {}
);
