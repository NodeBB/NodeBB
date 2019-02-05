'use strict';

(function (factory) {
	if (typeof module === 'object' && module.exports) {
		var relative_path = require('nconf').get('relative_path');
		module.exports = factory(require('../utils'), require('benchpressjs'), relative_path);
	} else if (typeof define === 'function' && define.amd) {
		define('helpers', ['benchpress'], function (Benchpress) {
			return factory(utils, Benchpress, config.relative_path);
		});
	}
}(function (utils, Benchpress, relative_path) {
	var helpers = {
		displayMenuItem: displayMenuItem,
		buildMetaTag: buildMetaTag,
		buildLinkTag: buildLinkTag,
		stringify: stringify,
		escape: escape,
		stripTags: stripTags,
		generateCategoryBackground: generateCategoryBackground,
		generateChildrenCategories: generateChildrenCategories,
		generateTopicClass: generateTopicClass,
		membershipBtn: membershipBtn,
		spawnPrivilegeStates: spawnPrivilegeStates,
		localeToHTML: localeToHTML,
		renderTopicImage: renderTopicImage,
		renderDigestAvatar: renderDigestAvatar,
		userAgentIcons: userAgentIcons,
		register: register,
		__escape: identity,
	};

	function identity(str) {
		return str;
	}

	function displayMenuItem(data, index) {
		var item = data.navigation[index];
		if (!item) {
			return false;
		}

		if (item.route.match('/users') && data.user && !data.user.privileges['view:users']) {
			return false;
		}

		if (item.route.match('/tags') && data.user && !data.user.privileges['view:tags']) {
			return false;
		}

		if (item.route.match('/groups') && data.user && !data.user.privileges['view:groups']) {
			return false;
		}

		return true;
	}

	function buildMetaTag(tag) {
		var name = tag.name ? 'name="' + tag.name + '" ' : '';
		var property = tag.property ? 'property="' + tag.property + '" ' : '';
		var content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + '/>\n\t';
	}

	function buildLinkTag(tag) {
		var link = tag.link ? 'link="' + tag.link + '" ' : '';
		var rel = tag.rel ? 'rel="' + tag.rel + '" ' : '';
		var type = tag.type ? 'type="' + tag.type + '" ' : '';
		var href = tag.href ? 'href="' + tag.href + '" ' : '';
		var sizes = tag.sizes ? 'sizes="' + tag.sizes + '" ' : '';
		var title = tag.title ? 'title="' + tag.title + '" ' : '';

		return '<link ' + link + rel + type + sizes + title + href + '/>\n\t';
	}

	function stringify(obj) {
		// Turns the incoming object into a JSON string
		return JSON.stringify(obj).replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function escape(str) {
		return utils.escapeHTML(str);
	}

	function stripTags(str) {
		return utils.stripHTMLTags(str);
	}

	function generateCategoryBackground(category) {
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
	}

	function generateChildrenCategories(category) {
		var html = '';
		if (!category || !category.children || !category.children.length) {
			return html;
		}
		category.children.forEach(function (child) {
			if (child && !child.isSection) {
				var link = child.link ? child.link : (relative_path + '/category/' + child.slug);
				html += '<span class="category-children-item pull-left">' +
					'<div class="icon pull-left" style="' + generateCategoryBackground(child) + '">' +
					'<i class="fa fa-fw ' + child.icon + '"></i>' +
					'</div>' +
					'<a href="' + link + '"><small>' + child.name + '</small></a></span>';
			}
		});
		html = html ? ('<span class="category-children">' + html + '</span>') : html;
		return html;
	}

	function generateTopicClass(topic) {
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
	}

	// Groups helpers
	function membershipBtn(groupObj) {
		if (groupObj.isMember && groupObj.name !== 'administrators') {
			return '<button class="btn btn-danger" data-action="leave" data-group="' + groupObj.displayName + '"><i class="fa fa-times"></i> [[groups:membership.leave-group]]</button>';
		}

		if (groupObj.isPending && groupObj.name !== 'administrators') {
			return '<button class="btn btn-warning disabled"><i class="fa fa-clock-o"></i> [[groups:membership.invitation-pending]]</button>';
		} else if (groupObj.isInvited) {
			return '<button class="btn btn-link" data-action="rejectInvite" data-group="' + groupObj.displayName + '">[[groups:membership.reject]]</button><button class="btn btn-success" data-action="acceptInvite" data-group="' + groupObj.name + '"><i class="fa fa-plus"></i> [[groups:membership.accept-invitation]]</button>';
		} else if (!groupObj.disableJoinRequests && groupObj.name !== 'administrators') {
			return '<button class="btn btn-success" data-action="join" data-group="' + groupObj.displayName + '"><i class="fa fa-plus"></i> [[groups:membership.join-group]]</button>';
		}
		return '';
	}

	function spawnPrivilegeStates(member, privileges) {
		var states = [];
		for (var priv in privileges) {
			if (privileges.hasOwnProperty(priv)) {
				states.push({
					name: priv,
					state: privileges[priv],
				});
			}
		}
		return states.map(function (priv) {
			var guestDisabled = ['groups:moderate', 'groups:posts:upvote', 'groups:posts:downvote', 'groups:local:login', 'groups:group:create'];
			var spidersEnabled = ['groups:find', 'groups:read', 'groups:topics:read', 'groups:view:users', 'groups:view:tags', 'groups:view:groups'];
			var disabled =
				(member === 'guests' && guestDisabled.includes(priv.name)) ||
				(member === 'spiders' && !spidersEnabled.includes(priv.name));

			return '<td class="text-center" data-privilege="' + priv.name + '"><input type="checkbox"' + (priv.state ? ' checked' : '') + (disabled ? ' disabled="disabled"' : '') + ' /></td>';
		}).join('');
	}

	function localeToHTML(locale, fallback) {
		locale = locale || fallback || 'en-GB';
		return locale.replace('_', '-');
	}

	function renderTopicImage(topicObj) {
		if (topicObj.thumb) {
			return '<img src="' + topicObj.thumb + '" class="img-circle user-img" title="' + topicObj.user.username + '" />';
		}
		return '<img component="user/picture" data-uid="' + topicObj.user.uid + '" src="' + topicObj.user.picture + '" class="user-img" title="' + topicObj.user.username + '" />';
	}

	function renderDigestAvatar(block) {
		if (block.teaser) {
			if (block.teaser.user.picture) {
				return '<img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 8px;" src="' + block.teaser.user.picture + '" title="' + block.teaser.user.username + '" />';
			}
			return '<div style="vertical-align: middle; width: 16px; height: 16px; line-height: 16px; font-size: 10px; margin-right: 8px; background-color: ' + block.teaser.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block;">' + block.teaser.user['icon:text'] + '</div>';
		}
		if (block.user.picture) {
			return '<img style="vertical-align: middle; width: 16px; height: 16px; padding-right: 8px;" src="' + block.user.picture + '" title="' + block.user.username + '" />';
		}
		return '<div style="vertical-align: middle; width: 16px; height: 16px; line-height: 16px; font-size: 10px; margin-right: 8px; background-color: ' + block.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block;">' + block.user['icon:text'] + '</div>';
	}

	function userAgentIcons(data) {
		var icons = '';

		switch (data.platform) {
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

		switch (data.browser) {
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
	}

	function register() {
		Object.keys(helpers).forEach(function (helperName) {
			Benchpress.registerHelper(helperName, helpers[helperName]);
		});
	}

	return helpers;
}));
