'use strict';

const nconf = require('nconf');
const mime = require('mime');
const path = require('path');

const user = require('../user');
const categories = require('../categories');
const posts = require('../posts');
const topics = require('../topics');
const utils = require('../utils');

const activitypub = module.parent.exports;
const Mocks = module.exports;

Mocks.profile = async (actors) => {
	// Should only ever be called by activitypub.actors.assert
	const profiles = (await Promise.all(actors.map(async (actor) => {
		if (!actor) {
			return null;
		}

		const uid = actor.id;
		const {
			preferredUsername, published, icon, image,
			name, summary, followerCount, followingCount,
			postcount, inbox, endpoints,
		} = actor;
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

			inbox,
			sharedInbox: endpoints ? endpoints.sharedInbox : null,
		};

		return payload;
	})));

	return profiles;
};

Mocks.post = async (objects) => {
	let single = false;
	if (!Array.isArray(objects)) {
		single = true;
		objects = [objects];
	}

	const posts = await Promise.all(objects.map(async (object) => {
		const acceptedTypes = ['Note', 'Page', 'Article'];
		if (!acceptedTypes.includes(object.type)) {
			return null;
		}

		const {
			id: pid,
			published,
			updated,
			attributedTo: uid,
			// conversation,
			name,
			content,
			sourceContent,
			inReplyTo: toPid,
			to,
			cc,
			attachment,
		} = object;

		const timestamp = new Date(published).getTime();
		let edited = new Date(updated);
		edited = Number.isNaN(edited.valueOf()) ? undefined : edited;

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
			_activitypub: { to, cc, attachment },
		};

		return payload;
	}));

	return single ? posts.pop() : posts;
};

Mocks.actors = {};

Mocks.actors.user = async (uid) => {
	let { username, userslug, displayname: name, aboutme, picture, 'cover:url': cover } = await user.getUserData(uid);
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
		name,
		preferredUsername: username,
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
	let { name, slug, description: summary, backgroundImage } = await categories.getCategoryData(cid);
	const publicKey = await activitypub.getPublicKey('cid', cid);

	if (backgroundImage) {
		const filename = utils.decodeHTMLEntities(backgroundImage).split('/').pop();
		const imagePath = path.join(nconf.get('upload_path'), 'category', filename);
		backgroundImage = {
			type: 'Image',
			mediaType: mime.getType(imagePath),
			url: `${nconf.get('url')}${utils.decodeHTMLEntities(backgroundImage)}`,
		};
	}

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
		preferredUsername: `cid.${cid}`,
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
	const published = new Date(parseInt(post.timestamp, 10)).toISOString();

	const raw = await posts.getPostField(post.pid, 'content');

	// todo: post visibility, category privileges integration
	const to = [activitypub._constants.publicAddress];
	const cc = [`${nconf.get('url')}/uid/${post.user.uid}/followers`];

	let inReplyTo = null;
	let name = null;
	if (post.toPid) { // direct reply
		inReplyTo = utils.isNumber(post.toPid) ? `${nconf.get('url')}/post/${post.toPid}` : post.toPid;
		const parentId = await posts.getPostField(post.toPid, 'uid');
		to.unshift(utils.isNumber(parentId) ? `${nconf.get('url')}/uid/${parentId}` : parentId);
	} else if (!post.isMainPost) { // reply to OP
		inReplyTo = utils.isNumber(post.topic.mainPid) ? `${nconf.get('url')}/post/${post.topic.mainPid}` : post.topic.mainPid;
		to.unshift(utils.isNumber(post.topic.uid) ? `${nconf.get('url')}/uid/${post.topic.uid}` : post.topic.uid);
	} else { // new topic
		name = await topics.getTitleByPid(post.pid);
	}

	const object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Note',
		to,
		cc,
		inReplyTo,
		published,
		url: id,
		attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
		audience: `${nconf.get('url')}/topic/${post.topic.slug}`,
		sensitive: false, // todo
		summary: null,
		name,
		content: post.content,
		source: {
			content: raw,
			mediaType: 'text/markdown',
		},
		// replies: {}  todo...
	};

	return object;
};
