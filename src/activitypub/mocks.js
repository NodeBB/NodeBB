'use strict';

const nconf = require('nconf');
const mime = require('mime');
const path = require('path');
const validator = require('validator');
const sanitize = require('sanitize-html');
const tokenizer = require('sbd');

const db = require('../database');
const user = require('../user');
const categories = require('../categories');
const posts = require('../posts');
const topics = require('../topics');
const messaging = require('../messaging');
const privileges = require('../privileges');
const plugins = require('../plugins');
const slugify = require('../slugify');
const translator = require('../translator');
const utils = require('../utils');

const accountHelpers = require('../controllers/accounts/helpers');

const isEmojiShortcode = /^:[\w]+:$/;

const activitypub = module.parent.exports;
const Mocks = module.exports;

/**
 * A more restrictive html sanitization run on top of standard sanitization from core.
 * Done so the output HTML is stripped of all non-essential items; mainly classes from plugins..
 */
const sanitizeConfig = {
	allowedTags: sanitize.defaults.allowedTags.concat(['img', 'picture', 'source']),
	allowedClasses: {
		'*': [],
		'p': ['quote-inline'],
	},
	allowedAttributes: {
		a: ['href', 'rel'],
		source: ['type', 'src', 'srcset', 'sizes', 'media', 'height', 'width'],
		img: ['alt', 'height', 'ismap', 'src', 'usemap', 'width', 'srcset'],
	},
};

Mocks._normalize = async (object) => {
	// Normalized incoming AP objects into expected types for easier mocking
	let { type, attributedTo, url, image, mediaType, content, source, attachment, cc } = object;

	switch (true) { // non-string attributedTo handling
		case Array.isArray(attributedTo): {
			attributedTo = attributedTo.reduce((valid, cur) => {
				if (typeof cur === 'string') {
					valid.push(cur);
				} else if (typeof cur === 'object') {
					if (cur.type === 'Person' && cur.id) {
						valid.push(cur.id);
					} else if (cur.type === 'Group' && cur.id) {
						// Add any groups found to cc where it is expected
						cc = Array.isArray(cc) ? cc : [cc];
						cc.push(cur.id);
					}
				}

				return valid;
			}, []);
			attributedTo = attributedTo.shift(); // take first valid uid
			break;
		}

		case typeof attributedTo === 'object' && attributedTo.hasOwnProperty('id'): {
			attributedTo = attributedTo.id;
		}
	}

	let sourceContent = source && source.mediaType === 'text/markdown' ? source.content : undefined;
	if (sourceContent) {
		content = null;
		sourceContent = await activitypub.helpers.remoteAnchorToLocalProfile(sourceContent, true);
	} else if (mediaType === 'text/markdown') {
		sourceContent = await activitypub.helpers.remoteAnchorToLocalProfile(content, true);
		content = null;
	} else if (content && content.length) {
		content = sanitize(content, sanitizeConfig);
		content = await activitypub.helpers.remoteAnchorToLocalProfile(content);
	} else {
		content = '<em>This post did not contain any content.</em>';
	}

	switch (true) { // image handling
		case image && image.hasOwnProperty('url') && !!image.url: {
			image = image.url;
			break;
		}

		case image && typeof image === 'string': {
			// no change
			break;
		}

		default: {
			image = null;
		}
	}
	if (image) {
		const parsed = new URL(image);
		const type = mime.getType(parsed.pathname);
		if (!type || !type.startsWith('image/')) {
			activitypub.helpers.log(`[activitypub/mocks.post] Received image not identified as image due to MIME type: ${image}`);
			image = null;
		}
	}

	if (url) { // Handle url array
		if (Array.isArray(url)) {
			// Special handling for Video type (from PeerTube specifically)
			if (type === 'Video') {
				const stream = url.reduce((memo, { type, mediaType, tag }) => {
					if (!memo) {
						if (type === 'Link' && mediaType === 'application/x-mpegURL') {
							memo = tag.reduce((memo, { type, mediaType, href, width, height }) => {
								if (!memo && (type === 'Link' && mediaType === 'video/mp4')) {
									memo = { mediaType, href, width, height };
								}

								return memo;
							}, null);
						}
					}

					return memo;
				}, null);

				if (stream) {
					attachment = attachment || [];
					attachment.push(stream);
				}
			}

			url = url.reduce((valid, cur) => {
				if (typeof cur === 'string') {
					valid.push(cur);
				} else if (typeof cur === 'object') {
					if (cur.type === 'Link' && cur.href) {
						if (!cur.mediaType || (cur.mediaType && cur.mediaType === 'text/html')) {
							valid.push(cur.href);
						}
					}
				}

				return valid;
			}, []);
			url = url.shift(); // take first valid url
		}
	}

	return {
		...object,
		cc,
		attributedTo,
		content,
		sourceContent,
		image,
		url,
		attachment,
	};
};

Mocks.profile = async (actors) => {
	// Should only ever be called by activitypub.actors.assert
	const profiles = await Promise.all(actors.map(async (actor) => {
		if (!actor) {
			return null;
		}

		const uid = actor.id;
		let hostname;
		let {
			url, preferredUsername, published, icon, image,
			name, summary, followers, inbox, endpoints, tag,
		} = actor;
		preferredUsername = slugify(preferredUsername || name);
		const { followers: followerCount, following: followingCount } = await activitypub.actors.getLocalFollowCounts(uid);

		try {
			({ hostname } = new URL(actor.id));
		} catch (e) {
			return null;
		}

		let picture;
		if (icon) {
			picture = typeof icon === 'string' ? icon : icon.url;
		}
		const iconBackgrounds = await user.getIconBackgrounds();
		let bgColor = Array.prototype.reduce.call(preferredUsername, (cur, next) => cur + next.charCodeAt(), 0);
		bgColor = iconBackgrounds[bgColor % iconBackgrounds.length];
		summary = summary || '';
		// Replace emoji in summary
		if (tag && Array.isArray(tag)) {
			tag
				.filter(tag => tag.type === 'Emoji' &&
					isEmojiShortcode.test(tag.name) &&
					tag.icon && tag.icon.mediaType && tag.icon.mediaType.startsWith('image/'))
				.forEach((tag) => {
					summary = summary.replace(new RegExp(tag.name, 'g'), `<img class="not-responsive emoji" src="${tag.icon.url}" title="${tag.name}" />`);
				});
		}

		// Add custom fields into user hash
		const customFields = actor.attachment && Array.isArray(actor.attachment) && actor.attachment.length ?
			actor.attachment
				.filter(attachment => activitypub._constants.acceptable.customFields.has(attachment.type))
				.reduce((map, { type, name, value, href, content }) => {
					// Defer to new style (per FEP fb2a)
					if (map.has(name) && type === 'PropertyValue') {
						return map;
					}

					// Strip html from received values (for security)
					switch (type) {
						case 'Note': {
							value = utils.stripHTMLTags(content);
							break;
						}

						case 'Link': {
							value = utils.stripHTMLTags(href);
							break;
						}

						case 'PropertyValue': {
							value = utils.stripHTMLTags(value);
							break;
						}
					}

					return map.set(name, value);
				}, new Map()) :
			undefined;

		const payload = {
			uid,
			username: `${preferredUsername}@${hostname}`,
			userslug: `${preferredUsername}@${hostname}`,
			displayname: name,
			fullname: name,
			joindate: new Date(published).getTime() || Date.now(),
			picture,
			status: 'offline',
			'icon:text': (preferredUsername[0] || '').toUpperCase(),
			'icon:bgColor': bgColor,
			uploadedpicture: undefined,
			'cover:url': !image || typeof image === 'string' ? image : image.url,
			'cover:position': '50% 50%',
			aboutme: posts.sanitize(summary),
			followerCount,
			followingCount,

			url,
			inbox,
			sharedInbox: endpoints ? endpoints.sharedInbox : null,
			followersUrl: followers,
			customFields: customFields && new URLSearchParams(customFields).toString(),
		};

		return payload;
	}));

	return profiles;
};

Mocks.category = async (actors) => {
	const categories = await Promise.all(actors.map(async (actor) => {
		if (!actor) {
			return null;
		}

		const cid = actor.id;
		let hostname;
		let {
			url, preferredUsername, icon, /* image, */
			name, summary, followers, inbox, endpoints, tag,
			postingRestrictedToMods,
		} = actor;
		preferredUsername = slugify(preferredUsername || name);
		/*
		const {
			followers: followerCount,
			following: followingCount
		} = await activitypub.actors.getLocalFollowCounts(uid);
		*/

		try {
			({ hostname } = new URL(actor.id));
		} catch (e) {
			return null;
		}

		// No support for category avatars yet ;(
		// let picture;
		// if (image) {
		// picture = typeof image === 'string' ? image : image.url;
		// }
		const iconBackgrounds = await user.getIconBackgrounds();
		let bgColor = Array.prototype.reduce.call(preferredUsername, (cur, next) => cur + next.charCodeAt(), 0);
		bgColor = iconBackgrounds[bgColor % iconBackgrounds.length];

		const backgroundImage = !icon || typeof icon === 'string' ? icon : icon.url;

		// Replace emoji in summary
		if (tag && Array.isArray(tag)) {
			tag
				.filter(tag => tag.type === 'Emoji' &&
					isEmojiShortcode.test(tag.name) &&
					tag.icon && tag.icon.mediaType && tag.icon.mediaType.startsWith('image/'))
				.forEach((tag) => {
					summary = summary.replace(new RegExp(tag.name, 'g'), `<img class="not-responsive emoji" src="${tag.icon.url}" title="${tag.name}" />`);
				});
		}

		const payload = {
			cid,
			name,
			handle: `${preferredUsername}@${hostname}`,
			slug: `${preferredUsername}@${hostname}`,
			description: summary,
			descriptionParsed: posts.sanitize(summary),
			icon: backgroundImage ? 'fa-none' : 'fa-comments',
			color: '#fff',
			bgColor,
			backgroundImage,
			imageClass: 'cover',
			numRecentReplies: 1,
			// followerCount,
			// followingCount,

			url,
			inbox,
			sharedInbox: endpoints ? endpoints.sharedInbox : null,
			followersUrl: followers,

			_activitypub: {
				postingRestrictedToMods,
			},
		};

		return payload;
	}));

	return categories;
};

Mocks.post = async (objects) => {
	let single = false;
	if (!Array.isArray(objects)) {
		single = true;
		objects = [objects];
	}

	const posts = await Promise.all(objects.map(async (object) => {
		object = await Mocks._normalize(object);

		if (
			!activitypub._constants.acceptedPostTypes.includes(object.type) ||
			!activitypub.helpers.isUri(object.id) // sanity-check the id
		) {
			return null;
		}

		let {
			id: pid,
			url,
			attributedTo: uid,
			inReplyTo: toPid,
			published, updated, name, content, sourceContent,
			to, cc, audience, attachment, tag, image,
		} = object;

		await activitypub.actors.assert(uid);

		const resolved = await activitypub.helpers.resolveLocalId(toPid);
		if (resolved.type === 'post') {
			toPid = resolved.id;
		}

		const timestamp = new Date(published).getTime();
		let edited = new Date(updated);
		edited = Number.isNaN(edited.valueOf()) ? undefined : edited;

		const payload = {
			uid,
			pid,
			// tid,  --> purposely omitted
			content,
			sourceContent,
			timestamp,
			toPid,

			title: name, // used in post.edit

			edited,
			editor: edited ? uid : undefined,
			_activitypub: { to, cc, audience, attachment, tag, url, image },
		};

		return payload;
	}));

	return single ? posts.pop() : posts;
};

Mocks.message = async (object) => {
	object = await Mocks._normalize(object);

	const message = {
		mid: object.id,
		uid: object.attributedTo,
		content: object.sourceContent || object.content,

		_activitypub: {
			attachment: object.attachment,
		},
	};

	return message;
};

Mocks.actors = {};

Mocks.actors.user = async (uid) => {
	const userData = await user.getUserData(uid);
	let { username, userslug, displayname, fullname, joindate, aboutme, picture, 'cover:url': cover } = userData;
	let fields = await accountHelpers.getCustomUserFields(0, userData);
	const publicKey = await activitypub.getPublicKey('uid', uid);

	let aboutmeParsed = '';
	if (aboutme) {
		aboutme = validator.escape(String(aboutme || ''));
		aboutmeParsed = await plugins.hooks.fire('filter:parse.aboutme', aboutme);
		aboutmeParsed = translator.escape(aboutmeParsed);
	}

	if (picture) {
		const imagePath = await user.getLocalAvatarPath(uid);
		picture = {
			type: 'Image',
			mediaType: mime.getType(imagePath),
			url: `${nconf.get('url')}${picture}`,
		};
	}

	if (cover) {
		const imagePath = await user.getLocalCoverPath(uid);
		cover = {
			type: 'Image',
			mediaType: mime.getType(imagePath),
			url: `${nconf.get('url')}${cover}`,
		};
	}

	const attachment = [];
	// Translate field names and values
	fields = await Promise.all(fields.map(async (field) => {
		const [name, value] = await Promise.all([
			translator.translate(field.name),
			translator.translate(field.value),
		]);
		field = { ...field, ...{ name, value } };
		return field;
	}));
	fields.forEach(({ type, name, value }) => {
		if (value) {
			if (type === 'input-link') {
				attachment.push({
					type: 'Link',
					name,
					href: value,
				});
			} else {
				attachment.push({
					type: 'Note',
					name,
					content: value,
				});
			}

			// Backwards compatibility
			attachment.push({
				type: 'PropertyValue',
				name,
				value,
			});
		}
	});

	return {
		...{
			'@context': [
				'https://www.w3.org/ns/activitystreams',
				'https://w3id.org/security/v1',
			],
			id: `${nconf.get('url')}/uid/${uid}`,
			url: `${nconf.get('url')}/user/${userslug}`,
			followers: `${nconf.get('url')}/uid/${uid}/followers`,
			following: `${nconf.get('url')}/uid/${uid}/following`,
			inbox: `${nconf.get('url')}/uid/${uid}/inbox`,
			outbox: `${nconf.get('url')}/uid/${uid}/outbox`,

			type: 'Person',
			name: username !== displayname ? fullname : username, // displayname is escaped, fullname is not
			preferredUsername: userslug,
			summary: aboutmeParsed,
			published: new Date(joindate).toISOString(),
			attachment,

			publicKey: {
				id: `${nconf.get('url')}/uid/${uid}#key`,
				owner: `${nconf.get('url')}/uid/${uid}`,
				publicKeyPem: publicKey,
			},

			endpoints: {
				sharedInbox: `${nconf.get('url')}/inbox`,
			},
		},
		...(picture && { icon: picture }),
		...(cover && { image: cover }),
	};
};

Mocks.actors.category = async (cid) => {
	const [
		{
			name, handle: preferredUsername, slug,
			descriptionParsed: summary, backgroundImage,
		},
		publicKey,
		canPost,
	] = await Promise.all([
		categories.getCategoryFields(cid,
			['name', 'handle', 'slug', 'description', 'descriptionParsed', 'backgroundImage']),
		activitypub.getPublicKey('cid', cid),
		privileges.categories.can('topics:create', cid, -2),
	]);

	let icon;
	if (backgroundImage) {
		const filename = path.basename(utils.decodeHTMLEntities(backgroundImage));
		icon = {
			type: 'Image',
			mediaType: mime.getType(filename),
			url: `${nconf.get('url')}${utils.decodeHTMLEntities(backgroundImage)}`,
		};
	} else {
		icon = await categories.icons.get(cid);
		icon = icon.get('png');
		icon = {
			type: 'Image',
			mediaType: 'image/png',
			url: `${nconf.get('url')}${icon}`,
		};
	}

	return {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
			'https://join-lemmy.org/context.json',
		],
		id: `${nconf.get('url')}/category/${cid}`,
		url: `${nconf.get('url')}/category/${slug}`,
		// followers: ,
		//  following: ,
		inbox: `${nconf.get('url')}/category/${cid}/inbox`,
		outbox: `${nconf.get('url')}/category/${cid}/outbox`,

		type: 'Group',
		name: utils.decodeHTMLEntities(name),
		preferredUsername,
		summary: utils.decodeHTMLEntities(summary),
		// image, // todo once categories have cover photos
		icon,
		postingRestrictedToMods: !canPost,

		publicKey: {
			id: `${nconf.get('url')}/category/${cid}#key`,
			owner: `${nconf.get('url')}/category/${cid}`,
			publicKeyPem: publicKey,
		},

		endpoints: {
			sharedInbox: `${nconf.get('url')}/inbox`,
		},
	};
};

Mocks.notes = {};

Mocks.notes.public = async (post) => {
	const id = `${nconf.get('url')}/post/${post.pid}`;

	// Return a tombstone for a deleted post
	if (post.deleted === true) {
		return Mocks.tombstone({
			id,
			formerType: 'Note',
			attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
			context: `${nconf.get('url')}/topic/${post.topic.tid}`,
			audience: `${nconf.get('url')}/category/${post.category.cid}`,
		});
	}

	const published = post.timestampISO;
	const updated = post.edited ? post.editedISO : null;

	const to = new Set([activitypub._constants.publicAddress]);
	const cc = new Set([`${nconf.get('url')}/uid/${post.user.uid}/followers`]);

	let inReplyTo = null;
	let tag = null;
	let followersUrl;

	let name = null;
	({ titleRaw: name } = await topics.getTopicFields(post.tid, ['title']));

	if (post.toPid) { // direct reply
		inReplyTo = utils.isNumber(post.toPid) ? `${nconf.get('url')}/post/${post.toPid}` : post.toPid;
		name = `Re: ${name}`;

		const parentId = await posts.getPostField(post.toPid, 'uid');
		followersUrl = await user.getUserField(parentId, 'followersUrl');
		to.add(utils.isNumber(parentId) ? `${nconf.get('url')}/uid/${parentId}` : parentId);
	} else if (!post.isMainPost) { // reply to OP
		inReplyTo = utils.isNumber(post.topic.mainPid) ? `${nconf.get('url')}/post/${post.topic.mainPid}` : post.topic.mainPid;
		name = `Re: ${name}`;

		to.add(utils.isNumber(post.topic.uid) ? `${nconf.get('url')}/uid/${post.topic.uid}` : post.topic.uid);
		followersUrl = await user.getUserField(post.topic.uid, 'followersUrl');
	} else { // new topic
		tag = post.topic.tags.map(tag => ({
			type: 'Hashtag',
			href: `${nconf.get('url')}/tags/${tag.valueEncoded}`,
			name: `#${tag.value}`,
		}));
	}

	if (followersUrl) {
		cc.add(followersUrl);
	}

	const content = await posts.getPostField(post.pid, 'content');
	post.content = content; // re-send raw content into parsePost
	const parsed = await posts.parsePost(post, 'activitypub.note');
	post.content = sanitize(parsed.content, sanitizeConfig);
	post.content = posts.relativeToAbsolute(post.content, posts.urlRegex);
	post.content = posts.relativeToAbsolute(post.content, posts.imgRegex);

	let source = null;
	const [markdownEnabled, mentionsEnabled] = await Promise.all([
		plugins.isActive('nodebb-plugin-markdown'),
		plugins.isActive('nodebb-plugin-mentions'),
	]);
	if (markdownEnabled) {
		// Re-parse for markdown
		const _post = { ...post };
		const raw = await posts.getPostField(post.pid, 'content');
		_post.content = raw;
		let { content } = await posts.parsePost(_post, 'markdown');
		content = posts.relativeToAbsolute(content, posts.mdImageUrlRegex);
		source = {
			content,
			mediaType: 'text/markdown',
		};
	}
	if (mentionsEnabled) {
		const mentions = require.main.require('nodebb-plugin-mentions');
		const matches = await mentions.getMatches(content);

		if (matches.size) {
			tag = tag || [];
			tag.push(...Array.from(matches).map(({ type, id: href, slug: name }) => {
				if (utils.isNumber(href)) { // local ref
					name = name.toLowerCase(); // local slugs are always lowercase
					href = `${nconf.get('url')}/${type === 'uid' ? 'user' : `category/${href}`}/${name.slice(1)}`;
					name = `${name}@${nconf.get('url_parsed').hostname}`;
				}

				return {
					type: 'Mention',
					href,
					name,
				};
			}));

			Array.from(matches)
				.reduce((ids, { id }) => {
					if (!utils.isNumber(id) && !to.has(id) && !cc.has(id)) {
						ids.push(id);
					}

					return ids;
				}, [])
				.forEach(id => cc.add(id));
		}
	}

	let attachment = await posts.attachments.get(post.pid) || [];
	const normalizeAttachment = attachment => attachment.map(({ mediaType, url, width, height }) => {
		let type;

		switch (true) {
			case mediaType && mediaType.startsWith('image'): {
				type = 'Image';
				break;
			}

			default: {
				type = 'Link';
				break;
			}
		}

		const payload = { type, mediaType, url };

		if (width || height) {
			payload.width = width;
			payload.height = height;
		}

		return payload;
	});

	// Special handling for main posts (as:Article w/ as:Note preview)
	const plaintext = posts.sanitizePlaintext(content);
	const isArticle = post.pid === post.topic.mainPid && plaintext.length > 500;
	const noteAttachment = isArticle ? [...attachment] : null;
	const [uploads, thumbs] = await Promise.all([
		posts.uploads.listWithSizes(post.pid),
		topics.getTopicField(post.tid, 'thumbs'),
	]);
	const isThumb = uploads.map(u => Array.isArray(thumbs) ? thumbs.includes(u.name) : false);

	uploads.forEach(({ name, width, height }, idx) => {
		const mediaType = mime.getType(name);
		const url = `${nconf.get('url') + nconf.get('upload_url')}/${name}`;
		(noteAttachment || attachment).push({ mediaType, url, width, height });
		if (isThumb[idx] && noteAttachment) {
			attachment.push({ mediaType, url, width, height });
		}
	});

	// Inspect post content for external imagery as well
	let match = posts.imgRegex.exec(post.content);
	while (match !== null) {
		if (match[1]) {
			const { hostname, pathname, href: url } = new URL(match[1]);
			if (hostname !== nconf.get('url_parsed').hostname) {
				const mediaType = mime.getType(pathname);
				(noteAttachment || attachment).push({ mediaType, url });
			}
		}
		match = posts.imgRegex.exec(post.content);
	}

	attachment = normalizeAttachment(attachment);
	let preview;
	let summary = null;
	if (isArticle) {
		preview = {
			type: 'Note',
			attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
			content: post.content,
			published,
			attachment: normalizeAttachment(noteAttachment),
		};

		const sentences = tokenizer.sentences(post.content, { newline_boundaries: true });
		// Append sentences to summary until it contains just under 500 characters of content
		const limit = 500;
		let remaining = limit;
		summary = sentences.reduce((memo, sentence) => {
			const clean = sanitize(sentence, {
				allowedTags: [],
				allowedAttributes: {},
			});
			remaining = remaining - clean.length;
			if (remaining > 0) {
				memo += ` ${sentence}`;
			}

			return memo;
		}, '');

		// Final sanitization to clean up tags
		summary = posts.sanitize(summary);
	}

	let context = await posts.getPostField(post.pid, 'context');
	context = context || `${nconf.get('url')}/topic/${post.topic.tid}`;

	/**
	 * audience is exposed as part of 1b12 but is now ignored by Lemmy.
	 * Remove this and most references to audience in 2026.
	 */
	let audience = utils.isNumber(post.category.cid) ? // default
		`${nconf.get('url')}/category/${post.category.cid}` : post.category.cid;
	if (inReplyTo) {
		const chain = await activitypub.notes.getParentChain(post.uid, inReplyTo);
		chain.forEach((post) => {
			audience = post.audience || audience;
		});
	}
	to.add(audience);

	let object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: isArticle ? 'Article' : 'Note',
		to: Array.from(to),
		cc: Array.from(cc),
		inReplyTo,
		published,
		updated,
		url: id,
		attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
		context,
		audience,
		summary,
		name,
		preview,
		content: post.content,
		source,
		tag,
		attachment,
		replies: `${id}/replies`,
	};

	({ object } = await plugins.hooks.fire('filter:activitypub.mocks.note', { object, post, private: false }));
	return object;
};

Mocks.notes.private = async ({ messageObj }) => {
	const id = `${nconf.get('url')}/message/${messageObj.mid}`;

	// Return a tombstone for a deleted message
	if (messageObj.deleted === 1) {
		return Mocks.tombstone({
			id,
			formerType: 'Note',
			attributedTo: `${nconf.get('url')}/uid/${messageObj.fromuid}`,
			// context: `${nconf.get('url')}/topic/${post.topic.tid}`,
		});
	}

	let uids = await messaging.getUidsInRoom(messageObj.roomId, 0, -1);
	uids = uids.filter(uid => String(uid) !== String(messageObj.fromuid)); // no author
	const to = new Set(uids.map(uid => (utils.isNumber(uid) ? `${nconf.get('url')}/uid/${uid}` : uid)));
	const published = messageObj.timestampISO;
	const updated = messageObj.edited ? messageObj.editedISO : undefined;

	const content = await messaging.getMessageField(messageObj.mid, 'content');
	messageObj.content = content; // re-send raw content into parsePost
	const parsed = await posts.parsePost(messageObj, 'activitypub.note');
	messageObj.content = sanitize(parsed.content, sanitizeConfig);
	messageObj.content = posts.relativeToAbsolute(messageObj.content, posts.urlRegex);
	messageObj.content = posts.relativeToAbsolute(messageObj.content, posts.imgRegex);

	let source;
	const markdownEnabled = await plugins.isActive('nodebb-plugin-markdown');
	if (markdownEnabled) {
		let { content } = messageObj;
		content = posts.relativeToAbsolute(content, posts.mdImageUrlRegex);

		source = {
			content,
			mediaType: 'text/markdown',
		};
	}

	const mentions = await user.getUsersFields(uids, ['uid', 'userslug']);
	const tag = [];
	tag.push(...mentions.map(({ uid, userslug }) => ({
		type: 'Mention',
		href: utils.isNumber(uid) ? `${nconf.get('url')}/uid/${uid}` : uid,
		name: utils.isNumber(uid) ? `${userslug}@${nconf.get('url_parsed').hostname}` : userslug,
	})));

	let inReplyTo;
	if (messageObj.toMid) {
		inReplyTo = utils.isNumber(messageObj.toMid) ?
			`${nconf.get('url')}/message/${messageObj.toMid}` :
			messageObj.toMid;
	}
	if (!inReplyTo) {
		// Get immediately preceding message
		const index = await db.sortedSetRank(`chat:room:${messageObj.roomId}:mids`, messageObj.mid);
		if (index > 0) {
			const mids = await db.getSortedSetRevRange(`chat:room:${messageObj.roomId}:mids`, 1, -1);
			let isSystem = await messaging.getMessagesFields(mids, ['system']);
			isSystem = isSystem.map(o => o.system);
			inReplyTo = mids.reduce((memo, mid, idx) => (memo || (!isSystem[idx] ? mid : undefined)), undefined);
			inReplyTo = utils.isNumber(inReplyTo) ? `${nconf.get('url')}/message/${inReplyTo}` : inReplyTo;
		}
	}

	let object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Note',
		to: Array.from(to),
		cc: [],
		inReplyTo,
		published,
		updated,
		url: id,
		attributedTo: `${nconf.get('url')}/uid/${messageObj.fromuid}`,
		// context: `${nconf.get('url')}/topic/${post.topic.tid}`,
		// audience: `${nconf.get('url')}/category/${post.category.cid}`,
		summary: null,
		// name,
		content: messageObj.content,
		source,
		tag,
		// attachment: [], // todo
		// replies: `${id}/replies`, // todo
	};

	({ object } = await plugins.hooks.fire('filter:activitypub.mocks.note', { object, post: messageObj, private: false }));
	return object;
};

Mocks.activities = {};

Mocks.activities.create = async (pid, uid, post) => {
	// Local objects only, post optional
	if (!utils.isNumber(pid)) {
		throw new Error('[[error:invalid-pid]]');
	}

	if (!post) {
		post = (await posts.getPostSummaryByPids([pid], uid, { stripTags: false })).pop();
		if (!post) {
			throw new Error('[[error:invalid-pid]]');
		}
	}

	const object = await activitypub.mocks.notes.public(post);
	const { to, cc, targets } = await activitypub.buildRecipients(object, { pid, uid: post.user.uid });
	object.to = to;
	object.cc = cc;

	const activity = {
		id: `${object.id}#activity/create/${Date.now()}`,
		type: 'Create',
		actor: object.attributedTo,
		to,
		cc,
		object,
	};

	return { activity, targets };
};

Mocks.tombstone = async properties => ({
	'@context': 'https://www.w3.org/ns/activitystreams',
	type: 'Tombstone',
	...properties,
});
