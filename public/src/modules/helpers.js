;(function(exports) {
	"use strict";
	/* globals define, utils, config */

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
				(properties.globalMod && !data.isGlobalMod && !data.isAdmin) ||
				(properties.adminOnly && !data.isAdmin) ||
				(properties.searchInstalled && !data.searchEnabled)) {
				return false;
			}
		}

		if (item.route.match('/users') && data.privateUserInfo && !data.config.loggedIn) {
			return false;
		}

		if (item.route.match('/tags') && data.privateTagListing && !data.config.loggedIn) {
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

	helpers.generateChildrenCategories = function(category) {
		var html = '';
		var relative_path = (typeof config !== 'undefined' ? config.relative_path : require('nconf').get('relative_path'));
		
		category.children.forEach(function(child) {
			if (!child) {
				return;
			}
			var link = child.link ? child.link : (relative_path + '/category/' + child.slug);
			html += '<a href="' + link + '">' +
					'<span class="fa-stack fa-lg">' +
					'<i style="color:' + child.bgColor + ';" class="fa fa-circle fa-stack-2x"></i>' +
					'<i style="color:' + child.color + ';" class="fa fa-stack-1x ' + child.icon + '"></i>' +
					'</span><small>' + child.name + '</small></a> ';
		});
		html = html ? ('<span class="category-children">' + html + '</span>') : html;
		return html;
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
			} else if (!groupObj.disableJoinRequests) {
				return '<button class="btn btn-success" data-action="join" data-group="' + groupObj.displayName + '"><i class="fa fa-plus"></i> [[groups:membership.join-group]]</button>';
			} else {
				return '';
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
			return '<img component="user/picture" data-uid="' + topicObj.user.uid + '" src="' + topicObj.user.picture + '" class="user-img" title="' + topicObj.user.username + '" />';
		}
	};

	helpers.renderDigestAvatar = function(block) {
		if (block.teaser) {
			if (block.teaser.user.picture) {
				return '<img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 1em;" src="' + block.teaser.user.picture + '" title="' + block.teaser.user.username + '" />';
			} else {
				return '<div style="width: 16px; height: 16px; line-height: 16px; font-size: 10px; margin-right: 1em; background-color: ' + block.teaser.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block;">' + block.teaser.user['icon:text'] + '</div>';
			}
		} else {
			if (block.user.picture) {
				return '<img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 1em;" src="' + block.user.picture + '" title="' + block.user.username + '" />';
			} else {
				return '<div style="width: 16px; height: 16px; line-height: 16px; font-size: 10px; margin-right: 1em; background-color: ' + block.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block;">' + block.user['icon:text'] + '</div>';
			}
		}
	};

	helpers.userAgentIcons = function(data) {
		var icons = '';

		switch(data.platform) {
			case 'Linux':
				icons += '<i class="fa fa-fw fa-linux"></i>';
				break;
			case 'Microsoft Windows':
				icons += '<i class="fa fa-fw fa-windows"></i>';
				break;
			case 'Apple Mac':
				icons += '<i class="fa fa-fw fa-apple"></i>';
				break;
			case 'Android':
				icons += '<i class="fa fa-fw fa-android"></i>';
				break;
			case 'iPad':
				icons += '<i class="fa fa-fw fa-tablet"></i>';
				break;
			case 'iPod':	// intentional fall-through
			case 'iPhone':
				icons += '<i class="fa fa-fw fa-mobile"></i>';
				break;
			default:
				icons += '<i class="fa fa-fw fa-question-circle"></i>';
				break;
		}

		switch(data.browser) {
			case 'Chrome':
				icons += '<i class="fa fa-fw fa-chrome"></i>';
				break;
			case 'Firefox':
				icons += '<i class="fa fa-fw fa-firefox"></i>';
				break;
			case 'Safari':
				icons += '<i class="fa fa-fw fa-safari"></i>';
				break;
			case 'IE':
				icons += '<i class="fa fa-fw fa-internet-explorer"></i>';
				break;
			case 'Edge':
				icons += '<i class="fa fa-fw fa-edge"></i>';
				break;
			default:
				icons += '<i class="fa fa-fw fa-question-circle"></i>';
				break;
		}

		return icons;
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
