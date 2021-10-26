'use strict';

(function (factory) {
	if (typeof module === 'object' && module.exports) {
		const relative_path = require('nconf').get('relative_path');
		module.exports = factory(require('../utils'), require('benchpressjs'), relative_path);
	} else if (typeof define === 'function' && define.amd) {
		define('helpers', ['benchpress'], function (Benchpress) {
			return factory(utils, Benchpress, config.relative_path);
		});
	}
}(function (utils, Benchpress, relative_path) {
	Benchpress.setGlobal('true', true);
	Benchpress.setGlobal('false', false);

	const helpers = {
		displayMenuItem,
		buildMetaTag,
		buildLinkTag,
		stringify,
		escape,
		stripTags,
		generateCategoryBackground,
		generateChildrenCategories,
		generateTopicClass,
		membershipBtn,
		spawnPrivilegeStates,
		localeToHTML,
		renderTopicImage,
		renderTopicEvents,
		renderEvents,
		renderDigestAvatar,
		userAgentIcons,
		buildAvatar,
		register,
		__escape: identity,
	};

	function identity(str) {
		return str;
	}

	function displayMenuItem(data, index) {
		const item = data.navigation[index];
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
		const name = tag.name ? 'name="' + tag.name + '" ' : '';
		const property = tag.property ? 'property="' + tag.property + '" ' : '';
		const content = tag.content ? 'content="' + tag.content.replace(/\n/g, ' ') + '" ' : '';

		return '<meta ' + name + property + content + '/>\n\t';
	}

	function buildLinkTag(tag) {
		const attributes = ['link', 'rel', 'as', 'type', 'href', 'sizes', 'title', 'crossorigin'];
		const [link, rel, as, type, href, sizes, title, crossorigin] = attributes.map(attr => (tag[attr] ? `${attr}="${tag[attr]}" ` : ''));

		return '<link ' + link + rel + as + type + sizes + title + href + crossorigin + '/>\n\t';
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
		const style = [];

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
		let html = '';
		if (!category || !category.children || !category.children.length) {
			return html;
		}
		category.children.forEach(function (child) {
			if (child && !child.isSection) {
				const link = child.link ? child.link : (relative_path + '/category/' + child.slug);
				html += '<span class="category-children-item pull-left">' +
					'<div role="presentation" class="icon pull-left" style="' + generateCategoryBackground(child) + '">' +
					'<i class="fa fa-fw ' + child.icon + '"></i>' +
					'</div>' +
					'<a href="' + link + '"><small>' + child.name + '</small></a></span>';
			}
		});
		html = html ? ('<span class="category-children">' + html + '</span>') : html;
		return html;
	}

	function generateTopicClass(topic) {
		const style = [];

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

		if (topic.scheduled) {
			style.push('scheduled');
		}

		return style.join(' ');
	}

	// Groups helpers
	function membershipBtn(groupObj) {
		if (groupObj.isMember && groupObj.name !== 'administrators') {
			return '<button class="btn btn-danger" data-action="leave" data-group="' + groupObj.displayName + '"' + (groupObj.disableLeave ? ' disabled' : '') + '><i class="fa fa-times"></i> [[groups:membership.leave-group]]</button>';
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
		const states = [];
		for (const priv in privileges) {
			if (privileges.hasOwnProperty(priv)) {
				states.push({
					name: priv,
					state: privileges[priv],
				});
			}
		}
		return states.map(function (priv) {
			const guestDisabled = ['groups:moderate', 'groups:posts:upvote', 'groups:posts:downvote', 'groups:local:login', 'groups:group:create'];
			const spidersEnabled = ['groups:find', 'groups:read', 'groups:topics:read', 'groups:view:users', 'groups:view:tags', 'groups:view:groups'];
			const globalModDisabled = ['groups:moderate'];
			const disabled =
				(member === 'guests' && (guestDisabled.includes(priv.name) || priv.name.startsWith('groups:admin:'))) ||
				(member === 'spiders' && !spidersEnabled.includes(priv.name)) ||
				(member === 'Global Moderators' && globalModDisabled.includes(priv.name));

			return '<td class="text-center" data-privilege="' + priv.name + '" data-value="' + priv.state + '"><input autocomplete="off" type="checkbox"' + (priv.state ? ' checked' : '') + (disabled ? ' disabled="disabled"' : '') + ' /></td>';
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

	function renderTopicEvents(index) {
		const start = this.posts[index].timestamp;
		const end = this.posts[index + 1] ? this.posts[index + 1].timestamp : Date.now();
		const events = this.events.filter(event => event.timestamp >= start && event.timestamp < end);
		if (!events.length) {
			return '';
		}

		return renderEvents.call(this, events);
	}

	function renderEvents(events) {
		return events.reduce((html, event) => {
			html += `<li component="topic/event" class="timeline-event" data-topic-event-id="${event.id}">
				<div class="timeline-badge">
					<i class="fa ${event.icon || 'fa-circle'}"></i>
				</div>
				<span class="timeline-text">
					${event.href ? `<a href="${relative_path}${event.href}">${event.text}</a>` : event.text}&nbsp;
				</span>
			`;

			if (event.user) {
				if (!event.user.system) {
					html += `<span><a href="${relative_path}/user/${event.user.userslug}">${buildAvatar(event.user, 'xs', true)}&nbsp;${event.user.username}</a></span>&nbsp;`;
				} else {
					html += `<span class="timeline-text">[[global:system-user]]</span>&nbsp;`;
				}
			}

			html += `<span class="timeago timeline-text" title="${event.timestampISO}"></span>`;

			if (this.privileges.isAdminOrMod) {
				html += `&nbsp;<span component="topic/event/delete" data-topic-event-id="${event.id}" class="timeline-text pointer" title="[[topic:delete-event]]"><i class="fa fa-trash"></i></span>`;
			}

			return html;
		}, '');
	}

	function renderDigestAvatar(block) {
		if (block.teaser) {
			if (block.teaser.user.picture) {
				return '<img style="vertical-align: middle; width: 32px; height: 32px; border-radius: 50%;" src="' + block.teaser.user.picture + '" title="' + block.teaser.user.username + '" />';
			}
			return '<div style="vertical-align: middle; width: 32px; height: 32px; line-height: 32px; font-size: 16px; background-color: ' + block.teaser.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block; border-radius: 50%;">' + block.teaser.user['icon:text'] + '</div>';
		}
		if (block.user.picture) {
			return '<img style="vertical-align: middle; width: 32px; height: 32px; border-radius: 50%;" src="' + block.user.picture + '" title="' + block.user.username + '" />';
		}
		return '<div style="vertical-align: middle; width: 32px; height: 32px; line-height: 32px; font-size: 16px; background-color: ' + block.user['icon:bgColor'] + '; color: white; text-align: center; display: inline-block; border-radius: 50%;">' + block.user['icon:text'] + '</div>';
	}

	function userAgentIcons(data) {
		let icons = '';

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

	function buildAvatar(userObj, size, rounded, classNames, component) {
		/**
		 * userObj requires:
		 *   - uid, picture, icon:bgColor, icon:text (getUserField w/ "picture" should return all 4), username
		 * size: one of "xs", "sm", "md", "lg", or "xl" (required), or an integer
		 * rounded: true or false (optional, default false)
		 * classNames: additional class names to prepend (optional, default none)
		 * component: overrides the default component (optional, default none)
		 */

		// Try to use root context if passed-in userObj is undefined
		if (!userObj) {
			userObj = this;
		}

		const attributes = [
			'alt="' + userObj.username + '"',
			'title="' + userObj.username + '"',
			'data-uid="' + userObj.uid + '"',
			'loading="lazy"',
		];
		const styles = [];
		classNames = classNames || '';

		// Validate sizes, handle integers, otherwise fall back to `avatar-sm`
		if (['xs', 'sm', 'sm2x', 'md', 'lg', 'xl'].includes(size)) {
			classNames += ' avatar-' + size;
		} else if (!isNaN(parseInt(size, 10))) {
			styles.push('width: ' + size + 'px;', 'height: ' + size + 'px;', 'line-height: ' + size + 'px;', 'font-size: ' + (parseInt(size, 10) / 16) + 'rem;');
		} else {
			classNames += ' avatar-sm';
		}
		attributes.unshift('class="avatar ' + classNames + (rounded ? ' avatar-rounded' : '') + '"');

		// Component override
		if (component) {
			attributes.push('component="' + component + '"');
		} else {
			attributes.push('component="avatar/' + (userObj.picture ? 'picture' : 'icon') + '"');
		}

		if (userObj.picture) {
			return '<img ' + attributes.join(' ') + ' src="' + userObj.picture + '" style="' + styles.join(' ') + '" />';
		}

		styles.push('background-color: ' + userObj['icon:bgColor'] + ';');
		return '<span ' + attributes.join(' ') + ' style="' + styles.join(' ') + '">' + userObj['icon:text'] + '</span>';
	}

	function register() {
		Object.keys(helpers).forEach(function (helperName) {
			Benchpress.registerHelper(helperName, helpers[helperName]);
		});
	}

	return helpers;
}));
