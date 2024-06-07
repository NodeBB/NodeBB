'use strict';

const nconf = require('nconf');
const mime = require('mime');
const path = require('path');
const sanitize = require('sanitize-html');

const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const posts = require('../posts');
const topics = require('../topics');
const plugins = require('../plugins');
const slugify = require('../slugify');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Mocks = module.exports;

/**
 * A more restrictive html sanitization run on top of standard sanitization from core.
 * Done so the output HTML is stripped of all non-essential items; mainly classes from plugins..
 */
const sanitizeConfig = {
	allowedClasses: {
		'*': [],
	},
};

Mocks.profile = async (actors) => {
	// Should only ever be called by activitypub.actors.assert
	const profiles = await Promise.all(actors.map(async (actor) => {
		if (!actor) {
			return null;
		}

		const uid = actor.id;
		let {
			url, preferredUsername, published, icon, image,
			name, summary, followers, followerCount, followingCount,
			postcount, inbox, endpoints,
		} = actor;
		preferredUsername = preferredUsername || slugify(name);

		const { hostname } = new URL(actor.id);

		let picture;
		if (icon) {
			picture = typeof icon === 'string' ? icon : icon.url;
		}
		const iconBackgrounds = await user.getIconBackgrounds();
		let bgColor = Array.prototype.reduce.call(preferredUsername, (cur, next) => cur + next.charCodeAt(), 0);
		bgColor = iconBackgrounds[bgColor % iconBackgrounds.length];

		const payload = {
			uid,
			username: `${preferredUsername}@${hostname}`,
			userslug: `${preferredUsername}@${hostname}`,
			displayname: name,
			fullname: name,
			joindate: new Date(published).getTime(),
			picture,
			status: 'offline',
			'icon:text': (preferredUsername[0] || '').toUpperCase(),
			'icon:bgColor': bgColor,
			uploadedpicture: undefined,
			'cover:url': !image || typeof image === 'string' ? image : image.url,
			'cover:position': '50% 50%',
			aboutme: summary,
			postcount,
			followerCount,
			followingCount,

			url,
			inbox,
			sharedInbox: endpoints ? endpoints.sharedInbox : null,
			followersUrl: followers,
		};

		return payload;
	}));

	return profiles;
};

Mocks.post = async (objects) => {
	let single = false;
	if (!Array.isArray(objects)) {
		single = true;
		objects = [objects];
	}

	const posts = await Promise.all(objects.map(async (object) => {
		if (!activitypub._constants.acceptedPostTypes.includes(object.type)) {
			return null;
		}

		let {
			id: pid,
			url,
			attributedTo: uid,
			inReplyTo: toPid,
			published, updated, name, content, sourceContent,
			to, cc, attachment, tag,
			// conversation, // mastodon-specific, ignored.
		} = object;

		const resolved = await activitypub.helpers.resolveLocalId(toPid);
		if (resolved.type === 'post') {
			toPid = resolved.id;
		}
		const timestamp = new Date(published).getTime();
		let edited = new Date(updated);
		edited = Number.isNaN(edited.valueOf()) ? undefined : edited;

		content = sanitize(content, sanitizeConfig);

		const payload = {
			uid,
			pid,
			// tid,  --> purposely omitted
			name,
			content,
			sourceContent,
			timestamp,
			toPid,

			edited,
			editor: edited ? uid : undefined,
			_activitypub: { to, cc, attachment, tag, url },
		};

		return payload;
	}));

	return single ? posts.pop() : posts;
};

Mocks.actors = {};

Mocks.actors.user = async (uid) => {
	let { username, userslug, displayname, fullname, aboutme, picture, 'cover:url': cover } = await user.getUserData(uid);
	const publicKey = await activitypub.getPublicKey('uid', uid);

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

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${nconf.get('url')}/uid/${uid}`,
		url: `${nconf.get('url')}/user/${userslug}`,
		followers: `${nconf.get('url')}/uid/${uid}/followers`,
		following: `${nconf.get('url')}/uid/${uid}/following`,
		inbox: `${nconf.get('url')}/uid/${uid}/inbox`,
		outbox: `${nconf.get('url')}/uid/${uid}/outbox`,
		sharedInbox: `${nconf.get('url')}/inbox`,

		type: 'Person',
		name: username !== displayname ? fullname : username, // displayname is escaped, fullname is not
		preferredUsername: userslug,
		summary: aboutme,
		icon: picture,
		image: cover,

		publicKey: {
			id: `${nconf.get('url')}/uid/${uid}#key`,
			owner: `${nconf.get('url')}/uid/${uid}`,
			publicKeyPem: publicKey,
		},
	};
};

Mocks.actors.category = async (cid) => {
	let {
		name, handle: preferredUsername, slug,
		description: summary, backgroundImage,
	} = await categories.getCategoryData(cid);
	const publicKey = await activitypub.getPublicKey('cid', cid);

	backgroundImage = backgroundImage || meta.config['brand:logo'] || `${nconf.get('relative_path')}/assets/logo.png`;
	const filename = path.basename(utils.decodeHTMLEntities(backgroundImage));
	backgroundImage = {
		type: 'Image',
		mediaType: mime.getType(filename),
		url: `${nconf.get('url')}${utils.decodeHTMLEntities(backgroundImage)}`,
	};

	return {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${nconf.get('url')}/category/${cid}`,
		url: `${nconf.get('url')}/category/${slug}`,
		// followers: ,
		//  following: ,
		inbox: `${nconf.get('url')}/category/${cid}/inbox`,
		outbox: `${nconf.get('url')}/category/${cid}/outbox`,
		sharedInbox: `${nconf.get('url')}/inbox`,

		type: 'Group',
		name,
		preferredUsername,
		summary,
		icon: backgroundImage,

		publicKey: {
			id: `${nconf.get('url')}/category/${cid}#key`,
			owner: `${nconf.get('url')}/category/${cid}`,
			publicKeyPem: publicKey,
		},
	};
};

Mocks.note = async (post) => {
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

	const published = new Date(parseInt(post.timestamp, 10)).toISOString();

	// todo: post visibility
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
		followersUrl = await user.getUserField(parentId, ['followersUrl']);
		to.add(utils.isNumber(parentId) ? `${nconf.get('url')}/uid/${parentId}` : parentId);
	} else if (!post.isMainPost) { // reply to OP
		inReplyTo = utils.isNumber(post.topic.mainPid) ? `${nconf.get('url')}/post/${post.topic.mainPid}` : post.topic.mainPid;
		name = `Re: ${name}`;

		to.add(utils.isNumber(post.topic.uid) ? `${nconf.get('url')}/uid/${post.topic.uid}` : post.topic.uid);
		followersUrl = await user.getUserField(post.topic.uid, ['followersUrl']);
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
	const { postData: parsed } = await plugins.hooks.fire('filter:parse.post', {
		postData: { content },
		type: 'activitypub.note',
	});
	post.content = sanitize(parsed.content, sanitizeConfig);
	post.content = posts.relativeToAbsolute(post.content, posts.urlRegex);
	post.content = posts.relativeToAbsolute(post.content, posts.imgRegex);

	let source = null;
	const [markdownEnabled, mentionsEnabled] = await Promise.all([
		plugins.isActive('nodebb-plugin-markdown'),
		plugins.isActive('nodebb-plugin-mentions'),
	]);
	if (markdownEnabled) {
		const raw = await posts.getPostField(post.pid, 'content');
		source = {
			content: raw,
			mediaType: 'text/markdown',
		};
	}
	if (mentionsEnabled) {
		const mentions = require.main.require('nodebb-plugin-mentions');
		const matches = await mentions.getMatches(post.content);

		if (matches.size) {
			tag = tag || [];
			tag.push(...Array.from(matches).map(({ id: href, slug: name }) => {
				if (utils.isNumber(href)) { // local ref
					name = name.toLowerCase(); // local slugs are always lowercase
					href = `${nconf.get('url')}/user/${name.slice(1)}`;
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
	const uploads = await posts.uploads.listWithSizes(post.pid);
	uploads.forEach(({ name, width, height }) => {
		const mediaType = mime.getType(name);
		const url = `${nconf.get('url') + nconf.get('upload_url')}/${name}`;
		attachment.push({ mediaType, url, width, height });
	});

	attachment = attachment.map(({ mediaType, url, width, height }) => {
		let type;

		switch (true) {
			case mediaType.startsWith('image'): {
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

	const object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Note',
		to: Array.from(to),
		cc: Array.from(cc),
		inReplyTo,
		published,
		url: id,
		attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
		context: `${nconf.get('url')}/topic/${post.topic.tid}`,
		audience: `${nconf.get('url')}/category/${post.category.cid}`,
		sensitive: false, // todo
		summary: null,
		name,
		content: post.content,
		source,
		tag,
		attachment,
		// replies: {}  todo...
	};

	return object;
};

Mocks.tombstone = async properties => ({
	'@context': 'https://www.w3.org/ns/activitystreams',
	type: 'Tombstone',
	...properties,
});
