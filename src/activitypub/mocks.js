'use strict';

const nconf = require('nconf');
const mime = require('mime');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');

const activitypub = module.parent.exports;
const Mocks = module.exports;

Mocks.profile = async (actors, callerUid = 0) => {
	// Accepts an array containing actor objects (the output of getActor()), or uris
	let single = false;
	if (!Array.isArray(actors)) {
		single = true;
		actors = [actors];
	}

	const profiles = (await Promise.all(actors.map(async (actor) => {
		// convert uri to actor object
		if (typeof actor === 'string' && activitypub.helpers.isUri(actor)) {
			actor = await activitypub.getActor(callerUid, actor);
		}

		if (!actor) {
			return null;
		}

		const uid = actor.id;
		const { preferredUsername, published, icon, image, name, summary, hostname, followerCount, followingCount } = actor;
		const isFollowing = await db.isSortedSetMember(`followingRemote:${callerUid}`, uid);

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
			aboutmeParsed: summary,

			isFollowing,
			counts: {
				following: followingCount,
				followers: followerCount,
			},
		};

		return payload;
	}))).filter(Boolean);

	return single ? profiles.pop() : profiles;
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
		};

		return payload;
	}));

	return single ? posts.pop() : posts;
};

Mocks.actor = async (uid) => {
	let { username, userslug, displayname: name, aboutme, picture, 'cover:url': cover } = await user.getUserData(uid);
	const publicKey = await activitypub.getPublicKey(uid);

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
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id: `${nconf.get('url')}/uid/${uid}`,
		url: `${nconf.get('url')}/user/${userslug}`,
		followers: `${nconf.get('url')}/user/${userslug}/followers`,
		following: `${nconf.get('url')}/user/${userslug}/following`,
		inbox: `${nconf.get('url')}/user/${userslug}/inbox`,
		outbox: `${nconf.get('url')}/user/${userslug}/outbox`,

		type: 'Person',
		name,
		preferredUsername: username,
		summary: aboutme,
		icon: picture,
		image: cover,

		publicKey: {
			id: `${nconf.get('url')}/user/${userslug}#key`,
			owner: `${nconf.get('url')}/user/${userslug}`,
			publicKeyPem: publicKey,
		},
	};
};

Mocks.note = async (post) => {
	const id = `${nconf.get('url')}/post/${post.pid}`;
	const published = new Date(post.timestamp).toISOString();

	const [raw, userslug] = await Promise.all([
		posts.getPostField(post.pid, 'content'),
		user.getUserField(post.user.uid, 'userslug'),
	]);

	// todo: post visibility, category privileges integration
	const to = [activitypub._constants.publicAddress];
	const cc = [`${nconf.get('url')}/user/${userslug}/followers`];

	let inReplyTo = null;
	if (post.toPid) {
		inReplyTo = activitypub.helpers.isUri(post.toPid) ? post.toPid : `${nconf.get('url')}/post/${post.toPid}`;
		const parentId = await posts.getPostField(post.toPid, 'uid');
		if (activitypub.helpers.isUri(parentId)) {
			to.unshift(parentId);
		}
	} else {
		const mainPid = await topics.getTopicFieldByPid('mainPid', post.pid);
		if (mainPid !== post.pid) {
			inReplyTo = `${nconf.get('url')}/post/${mainPid}`;
		}
	}

	const object = {
		id,
		type: 'Note',
		to,
		cc,
		inReplyTo,
		published,
		url: id,
		attributedTo: `${nconf.get('url')}/uid/${post.user.uid}`,
		sensitive: false, // todo
		content: post.content,
		source: {
			content: raw,
			mediaType: 'text/markdown',
		},
		// replies: {}  todo...
	};

	return object;
};
