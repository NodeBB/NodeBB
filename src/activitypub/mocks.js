'use strict';

const winston = require('winston');

const db = require('../database');
const user = require('../user');

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
	const postCache = require('../posts/cache');

	let single = false;
	if (!Array.isArray(objects)) {
		single = true;
		objects = [objects];
	}

	const posts = (await Promise.all(objects.map(async (object) => {
		if (object.type !== 'Note') {
			return null;
		}

		const {
			id: pid,
			published,
			updated,
			attributedTo: uid,
			// conversation,
			content,
			sourceContent,
			inReplyTo: toPid,
		} = object;

		const timestamp = new Date(published);
		let edited = new Date(updated);
		edited = Number.isNaN(edited.valueOf()) ? 0 : edited;

		// If no source content, then `content` is pre-parsed and should be HTML, so cache it
		if (!sourceContent) {
			winston.verbose(`[activitypub/mockPost] pid ${pid} already has pre-parsed HTML content, adding to post cache...`);
			postCache.set(pid, content);
		}

		const payload = {
			uid,
			pid,
			timestamp: timestamp.getTime(),
			timestampISO: timestamp.toISOString(),
			content: sourceContent || content,
			toPid,

			edited,
			editor: edited ? uid : undefined,
			editedISO: edited ? edited.toISOString() : '',

			deleted: 0,
			deleterUid: 0,
			replies: 0, // todo
			bookmarks: 0,
			votes: 0, // todo
		};

		return payload;
	}))).filter(Boolean);

	return single ? posts.pop() : posts;
};
