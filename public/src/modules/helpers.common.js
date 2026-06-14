'use strict';

module.exports = function (utils, Benchpress, translator, relative_path) {
	Benchpress.setGlobal('true', true);
	Benchpress.setGlobal('false', false);
	const oneDayInMs = 24 * 60 * 60 * 1000;

	const helpers = {
		__escape: escape,
		escape,
		txEscape: translator.escape,
		txEscapeArg: translator.escapeArg,
		tx,
		buildMetaTag,
		quote,
		buildLinkTag,
		stringify,
		displayMenuItem,
		stripTags,
		buildCategoryIcon,
		buildCategoryLabel,
		generateCategoryBackground,
		generateChildrenCategories,
		generateTopicClass,
		generateGroupDisplayName,
		membershipBtn,
		spawnPrivilegeStates,
		localeToHTML,
		renderDigestAvatar,
		userAgentIcons,
		buildAvatar,
		increment,
		lessthan,
		greaterthan,
		max,
		min,
		clamp,
		generateWroteReplied,
		generateRepliedTo,
		generateWrote,
		encodeURIComponent: _encodeURIComponent,
		isoTimeToLocaleString,
		shouldHideReplyContainer,
		humanReadableNumber,
		formattedNumber,
		isNumber,
		uploadBasename,
		generatePlaceholderWave,
		register,
	};

	function escape(str) {
		return translator.escape(
			utils.escapeHTML(utils.decodeHTMLEntities(
				String(str)
			))
		);
	}

	function tx(token, ...args) {
		if (Array.isArray(token) && token.length) {
			args = [...token.slice(1)];
			token = token[0];
		}
		if (!token) {
			return '';
		}

		const [txToken, argsFromToken] = translator.normalizeToken(token);
		if (Array.isArray(argsFromToken) && argsFromToken.length > 0) {
			args = argsFromToken;
		}
		const [namespace, key] = txToken.split(':', 2);
		if (!namespace || !key || !this?._i18n?.[namespace]?.[key]) {
			return translator.fixDoubleEscaped(translator.escapeHTML(token));
		}

		const escapedArgs = args.map((arg) => {
			const escapedArg = translator.fixDoubleEscaped(translator.escapeHTML(arg));

			if (escapedArg.startsWith('[[') && escapedArg.endsWith(']]')) {
				return helpers.tx.call(this, escapedArg, []); // no escapedArguments on nested tokens for now
			}
			return escapedArg;
		});

		const translation = this._i18n[namespace][key];
		const result = translator.replaceArguments(translation, escapedArgs);
		// prevents the translator.translate() in
		// app.parseAndTraslate and page render from translating again
		return translator.escape(result);
	}

	function quote(str) {
		return `"${str}"`;
	}

	function buildMetaTag(tag) {
		const name = tag.name ? `name="${escape(tag.name)}" ` : '';
		const property = tag.property ? `property="${escape(tag.property)}" ` : '';
		const content = tag.content ? `content="${escape(tag.content).replace(/\n/g, ' ')}" ` : '';

		return '<meta ' + name + property + content + '/>\n\t';
	}

	function buildLinkTag(tag) {
		const attributes = [
			'link', 'rel', 'as', 'type', 'href', 'hreflang', 'sizes', 'title', 'crossorigin',
		];
		const [link, rel, as, type, href, hreflang, sizes, title, crossorigin] = attributes.map(
			attr => (tag[attr] ? `${attr}="${escape(tag[attr])}" ` : '')
		);

		return '<link ' + link + rel + as + type + sizes + title + href + hreflang + crossorigin + '/>\n\t';
	}

	function stringify(obj) {
		// Turns the incoming object into a JSON string
		return JSON.stringify(obj).replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;')
			.replace(/"/g, '&quot;');
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

	function stripTags(str) {
		return utils.stripHTMLTags(str);
	}

	function buildCategoryIcon(category, size, rounded) {
		if (!category) {
			return '';
		}
		const sizeEscaped = escape(size);
		const fontSize = (parseInt(size, 10) / 2) || 16;
		return `<span class="icon d-inline-flex justify-content-center align-items-center align-middle ${rounded}" style="${generateCategoryBackground(category)} width:${sizeEscaped}; height: ${sizeEscaped}; font-size: ${fontSize}px;">${category.icon ? `<i class="fa fa-fw ${escape(category.icon)}"></i>` : ''}</span>`;
	}

	function buildCategoryLabel(category, tag = 'a', className = '') {
		if (!category) {
			return '';
		}
		className = className ? escape(className) : '';
		const icon = category.icon ? escape(category.icon) : '';
		const bgColor = escape(category.bgColor);
		const color = escape(category.color);
		if (!['a', 'span'].includes(tag)) {
			tag = 'span';
		}
		const href = tag === 'a' ? `href="${relative_path}/category/${escape(category.slug)}"` : '';
		return `<${tag} component="topic/category" ${href} class="badge px-1 text-truncate text-decoration-none ${className}" style="color: ${color};background-color: ${bgColor};border-color: ${bgColor}!important; max-width: 70vw;">
			${icon && icon !== 'fa-nbb-none' ? `<i class="fa fa-fw ${icon}"></i>` : ''}
			${escape(tx.call(this, String(category.name)))}
		</${tag}>`;
	}

	function generateCategoryBackground(category) {
		if (!category) {
			return '';
		}
		const style = [];

		if (category.bgColor) {
			style.push(`background-color: ${category.bgColor}`);
			style.push(`border-color: ${category.bgColor} !important`);
		}

		if (category.color) {
			style.push(`color: ${category.color}`);
		}

		if (category.backgroundImage) {
			style.push(`background-image: url(${category.backgroundImage})`);
			if (category.imageClass) {
				style.push(`background-size: ${category.imageClass}`);
			}
		}

		return escape(style.join('; ') + ';');
	}

	function generateChildrenCategories(category) {
		let html = '';
		if (!category || !category.children || !category.children.length) {
			return html;
		}
		category.children.forEach(function (child) {
			if (child && !child.isSection) {
				const link = child.link ? child.link : (relative_path + '/category/' + child.slug);
				html += '<span class="category-children-item">' +
					`<div role="presentation" class="icon" style="${generateCategoryBackground(child)}">` +
					`<i class="fa fa-fw ${escape(child.icon)}"></i>` +
					'</div>' +
					`<a href="${escape(link)}"><small>${escape(child.name)}</small></a></span>`;
			}
		});
		return html ? (`<span class="category-children">${html}</span>`) : html;
	}

	function generateTopicClass(topic) {
		const fields = ['locked', 'pinned', 'deleted', 'unread', 'scheduled'];
		return fields.filter(field => !!topic[field]).join(' ');
	}

	function generateGroupDisplayName(group) {
		return group.system ? group.displayName.replace(/-/g, ' ') : group.displayName;
	}

	// Groups helpers
	function membershipBtn(groupObj, btnClass = '') {
		btnClass = btnClass ? escape(btnClass) : '';
		const displayName = groupObj.displayName ? escape(groupObj.displayName) : '';

		if (groupObj.isMember && groupObj.name !== 'administrators') {
			return `<button class="btn btn-danger text-nowrap ${btnClass}" data-action="leave" data-group="${displayName}" ${(groupObj.disableLeave ? ' disabled' : '')}><i class="fa fa-times"></i> [[groups:membership.leave-group]]</button>`;
		}

		if (groupObj.isPending && groupObj.name !== 'administrators') {
			return `<button class="btn btn-warning text-nowrap disabled ${btnClass}"><i class="fa fa-clock-o"></i> [[groups:membership.invitation-pending]]</button>`;
		} else if (groupObj.isInvited) {
			return `<button class="btn btn-warning text-nowrap" data-action="rejectInvite" data-group="${displayName}">[[groups:membership.reject]]</button><button class="btn btn-success" data-action="acceptInvite" data-group="${escape(groupObj.name)}"><i class="fa fa-plus"></i> [[groups:membership.accept-invitation]]</button>`;
		} else if (!groupObj.disableJoinRequests && groupObj.name !== 'administrators') {
			return `<button class="btn btn-success text-nowrap ${btnClass}" data-action="join" data-group="${displayName}"><i class="fa fa-plus"></i> [[groups:membership.join-group]]</button>`;
		}
		return '';
	}

	function spawnPrivilegeStates(cid, member, privileges, types) {
		const states = [];
		for (const [priv, state] of Object.entries(privileges)) {
			states.push({
				name: priv,
				state: state,
				type: types[priv],
			});
		}
		return states.map(function (priv) {
			const guestDisabled = ['groups:moderate', 'groups:posts:upvote', 'groups:posts:downvote', 'groups:local:login', 'groups:group:create'];
			const spidersEnabled = ['groups:find', 'groups:read', 'groups:topics:read', 'groups:view:users', 'groups:view:tags', 'groups:view:groups'];
			const globalModDisabled = ['groups:moderate'];
			let fediverseEnabled = ['groups:view:users', 'groups:find', 'groups:read', 'groups:topics:read', 'groups:topics:create', 'groups:topics:reply', 'groups:topics:tag', 'groups:posts:edit', 'groups:posts:history', 'groups:posts:delete', 'groups:posts:upvote', 'groups:posts:downvote', 'groups:topics:delete'];
			if (cid === -1) {
				fediverseEnabled = fediverseEnabled.slice(3);
			}
			const disabled =
				(member === 'guests' && (guestDisabled.includes(priv.name) || priv.name.startsWith('groups:admin:'))) ||
				(member === 'spiders' && !spidersEnabled.includes(priv.name)) ||
				(member === 'fediverse' && !fediverseEnabled.includes(priv.name)) ||
				(member === 'Global Moderators' && globalModDisabled.includes(priv.name));

			return `
				<td data-privilege="${escape(priv.name)}" data-value="${escape(priv.state)}" data-type="${escape(priv.type)}">
					<div class="form-check text-center">
						<input class="form-check-input float-none${(disabled ? ' d-none"' : '')}" autocomplete="off" type="checkbox"${(priv.state ? ' checked' : '')}${(disabled ? ' disabled="disabled" aria-diabled="true"' : '')} />
					</div>
				</td>
			`;
		}).join('');
	}

	function localeToHTML(locale, fallback) {
		locale = locale || fallback || 'en-GB';
		return locale.replace('_', '-');
	}

	function renderDigestAvatar(block) {
		const user = block.teaser && block.teaser.user ? block.teaser.user : block.user;
		if (!user) return '';
		const imgStyle = `vertical-align: middle; width: 32px; height: 32px; border-radius: 50%;`;
		const iconStyle = `vertical-align: middle; width: 32px; height: 32px; line-height: 32px; font-size: 16px; color: white; text-align: center; display: inline-block; border-radius: 50%; background-color: ${escape(user['icon:bgColor'])};`;

		if (user.picture) {
			return `<img style="${imgStyle}" src="${escape(user.picture)}" title="${escape(user.username)}" />`;
		}
		return `<div style="${iconStyle}">${escape(user['icon:text'])}</div>`;
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
			case 'iPod': // intentional fall-through
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
			case 'Opera':
				icons += '<i class="fa fa-fw fa-opera"></i>';
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
		 * size: a picture size in the form of a value with units (e.g. 64px, 4rem, etc.)
		 * rounded: true or false (optional, default false)
		 * classNames: additional class names to prepend (optional, default none)
		 * component: overrides the default component (optional, default none)
		 */

		// Try to use root context if passed-in userObj is undefined
		if (!userObj) {
			userObj = this;
		}
		classNames = escape(classNames || '');
		component = escape(component || '');
		const displayname = escape(String(userObj.displayname || ''));
		const picture = escape(String(userObj.picture || ''));
		const iconBgColor = escape(String(userObj['icon:bgColor'] || ''));
		const iconText = escape(String(userObj['icon:text'] || ''));
		const attributes = new Map([
			['title', displayname],
			['data-uid', userObj.uid],
			['class', `avatar ${classNames}${rounded ? ' avatar-rounded' : ''}`],
		]);
		const style = escape(`--avatar-size: ${size};`);
		const attr2String = attributes => Array.from(attributes).reduce((output, [prop, value]) => {
			output += ` ${prop}="${value}"`;
			return output;
		}, '');

		let output = '';

		if (userObj.picture) {
			output += `<img${attr2String(attributes)} alt="${displayname}" loading="lazy" component="${component || 'avatar/picture'}" src="${picture}" style="${style}" onError="this.remove()" itemprop="image" />`;
		}
		output += `<span${attr2String(attributes)} component="${component || 'avatar/icon'}" style="${style} background-color: ${iconBgColor}">${iconText}</span>`;
		return output;
	}

	function increment(value, inc) {
		return String(value + parseInt(inc, 10));
	}

	function lessthan(a, b) {
		return parseInt(a, 10) < parseInt(b, 10);
	}

	function greaterthan(a, b) {
		return parseInt(a, 10) > parseInt(b, 10);
	}

	function max(a, b) {
		return Math.max(parseInt(a, 10), parseInt(b, 10));
	}

	function min(a, b) {
		return Math.min(parseInt(a, 10), parseInt(b, 10));
	}

	function clamp(value, minValue, maxValue) {
		return Math.min(Math.max(parseInt(value, 10), parseInt(minValue, 10)), parseInt(maxValue, 10));
	}

	function generateWroteReplied(post, timeagoCutoff) {
		if (post.toPid) {
			return generateRepliedTo.call(this, post, timeagoCutoff);
		}
		return generateWrote.call(this, post, timeagoCutoff);
	}

	function generateRepliedTo(post, timeagoCutoff) {
		const displayname = post.parent && post.parent.displayname ?
			post.parent.displayname : '[[global:guest]]';
		const isBeforeCutoff = post.timestamp < (Date.now() - (timeagoCutoff * oneDayInMs));
		const langSuffix = isBeforeCutoff ? 'on' : 'ago';
		return tx.call(this,
			`topic:replied-to-user-${langSuffix}`,
			escape(post.toPid),
			`${relative_path}/post/${encodeURIComponent(post.toPid)}`,
			escape(displayname),
			`${relative_path}/post/${encodeURIComponent(post.pid)}`,
			post.timestampISO,
		);
	}

	function generateWrote(post, timeagoCutoff) {
		const isBeforeCutoff = post.timestamp < (Date.now() - (timeagoCutoff * oneDayInMs));
		const langSuffix = isBeforeCutoff ? 'on' : 'ago';
		return tx.call(this,
			`topic:wrote-${langSuffix}`,
			`${relative_path}/post/${encodeURIComponent(post.pid)}`,
			post.timestampISO
		);
	}

	function _encodeURIComponent(value) {
		return encodeURIComponent(value);
	}

	function isoTimeToLocaleString(isoTime, locale = 'en-GB') {
		return new Date(isoTime).toLocaleString([locale], {
			dateStyle: 'short',
			timeStyle: 'short',
		}).replace(/,/g, '&#44;');
	}

	function shouldHideReplyContainer(post) {
		return post.replies.count <= 0 || post.replies.hasSingleImmediateReply;
	}

	function humanReadableNumber(number, toFixed = 1) {
		return utils.makeNumberHumanReadable(number, toFixed);
	}

	function formattedNumber(number) {
		return utils.addCommas(number);
	}

	function isNumber(value) {
		return utils.isNumber(value);
	}

	function uploadBasename(str, sep = '/') {
		const hasTimestampPrefix = /^\d+-/;
		const name = str.substr(str.lastIndexOf(sep) + 1);
		return hasTimestampPrefix.test(name) ? name.slice(14) : name;
	}

	function generatePlaceholderWave(items) {
		const html = items.map((i) => {
			if (i === 'divider') {
				return '<li class="dropdown-divider"></li>';
			}
			const size = parseInt(i, 10) || 1;
			return `
			<li class="dropdown-item placeholder-wave">
				<div class="placeholder" style="width: 20px;"></div>
				<div class="placeholder col-${size}"></div>
			</li>`;
		});

		return html.join('');
	}

	function register() {
		Object.keys(helpers).forEach(function (helperName) {
			Benchpress.registerHelper(helperName, helpers[helperName]);
		});
	}

	return helpers;
};
