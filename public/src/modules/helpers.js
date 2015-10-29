;(function(exports) {
	"use strict";
	/* globals define, utils */

	// export the class if we are in a Node-like system.
	if (typeof module === 'object' && module.exports === exports) {
		exports = module.exports/* = SemVer*/;
	}

	var helpers = {};

	helpers.displayMenuItem = function(data, index) {
		var item = data.navigation[index];
		if (!item) {
			return false;
		}
		var properties = item.properties;

		if (properties) {
			if ((properties.loggedIn && !data.config.loggedIn) ||
				(properties.adminOnly && !data.isAdmin) ||
				(properties.installed && properties.installed.search && !data.searchEnabled)) {
				return false;
			}
		}

		if (item.route.match('/users') && data.config.privateUserInfo && !data.config.loggedIn) {
			return false;
		}

		if (item.route.match('/tags') && data.config.privateTagListing && !data.config.loggedIn) {
			return false;
		}

		return true;
	};

	helpers.buildMetaTag = function(tag) {
		var name = tag.name ? 'name="' + tag.name + '" ' : '',
			property = tag.property ? 'property="' + tag.property + '" ' : '',
			content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + '/>\n\t';
	};

	helpers.buildLinkTag = function(tag) {
		var link = tag.link ? 'link="' + tag.link + '" ' : '',
			rel = tag.rel ? 'rel="' + tag.rel + '" ' : '',
			type = tag.type ? 'type="' + tag.type + '" ' : '',
			href = tag.href ? 'href="' + tag.href + '" ' : '',
			sizes = tag.sizes ? 'sizes="' + tag.sizes + '" ' : '';

		return '<link ' + link + rel + type + sizes + href + '/>\n\t';
	};

	helpers.stringify = function(obj) {
		// Turns the incoming object into a JSON string
		return JSON.stringify(obj).replace(/&/gm,"&amp;").replace(/</gm,"&lt;").replace(/>/gm,"&gt;").replace(/"/g, '&quot;');
	};

	helpers.escape = function(str) {
		if (typeof utils !== 'undefined') {
			return utils.escapeHTML(str);
		} else {
			return require('../utils').escapeHTML(str);
		}
	};

	helpers.stripTags = function(str) {
		if (typeof S !== 'undefined') {
			return S(str).stripTags().s;
		} else {
			var S = require('string');
			return S(str).stripTags().s;
		}
	};

	helpers.generateCategoryBackground = function(category) {
		if (!category) {
			return '';
		}
		var style = [];

		if (category.bgColor) {
			style.push('background-color: ' + category.bgColor);
		}

		if (category.color) {
			style.push('color: ' + category.color);
		}

		if (category.backgroundImage) {
			style.push('background-image: url(' + category.backgroundImage + ')');
			if (category.imageClass) {
				style.push('background-size: ' + category.imageClass);
			}
		}

		return style.join('; ') + ';';
	};

	helpers.generateTopicClass = function(topic) {
		var style = [];

		if (topic.locked) {
			style.push('locked');
		}

		if (topic.pinned) {
			style.push('pinned');
		}

		if (topic.deleted) {
			style.push('deleted');
		}

		if (topic.unread) {
			style.push('unread');
		}

		return style.join(' ');
	};

	helpers.getBookmarkFromIndex = function(topic) {
		return (topic.index || 0) + 1;
	};

	helpers.displayUserSearch = function(data, allowGuestUserSearching) {
		return data.loggedIn || allowGuestUserSearching === 'true';
	};

	// Groups helpers
	helpers.membershipBtn = function(groupObj) {
		if (groupObj.name === 'administrators') {
			return '';
		}

		if (groupObj.isMember) {
			return '<button class="btn btn-danger" data-action="leave" data-group="' + groupObj.displayName + '"><i class="fa fa-times"></i> [[groups:membership.leave-group]]</button>';
		} else {
			if (groupObj.isPending) {
				return '<button class="btn btn-warning disabled"><i class="fa fa-clock-o"></i> [[groups:membership.invitation-pending]]</button>';
			} else if (groupObj.isInvited) {
				return '<button class="btn btn-link" data-action="rejectInvite" data-group="' + groupObj.displayName + '">[[groups:membership.reject]]</button><button class="btn btn-success" data-action="acceptInvite" data-group="' + groupObj.name + '"><i class="fa fa-plus"></i> [[groups:membership.accept-invitation]]</button>';
			} else {
				return '<button class="btn btn-success" data-action="join" data-group="' + groupObj.displayName + '"><i class="fa fa-plus"></i> [[groups:membership.join-group]]</button>';
			}
		}
	};

	helpers.spawnPrivilegeStates = function(member, privileges) {
		var states = [];
		for(var priv in privileges) {
			if (privileges.hasOwnProperty(priv)) {
				states.push({
					name: priv,
					state: privileges[priv]
				});
			}
		}
		return states.map(function(priv) {
			return '<td class="text-center" data-privilege="' + priv.name + '"><input type="checkbox"' + (priv.state ? ' checked' : '') + (member === 'guests' && priv.name === 'groups:moderate' ? ' disabled="disabled"' : '') + ' /></td>';
		}).join('');
	};

	helpers.localeToHTML = function(locale) {
		return locale.replace('_', '-');
	};

	helpers.renderTopicImage = function(topicObj) {
		if (topicObj.thumb) {
			return '<img src="' + topicObj.thumb + '" class="img-circle user-img" title="' + topicObj.user.username + '" />';
		} else {
			return '<img data-component="user/picture" data-uid="' + topicObj.user.uid + '" src="' + topicObj.user.picture + '" class="user-img" title="' + topicObj.user.username + '" />';
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
