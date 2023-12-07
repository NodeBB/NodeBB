'use strict';

const db = require('../../database');
const user = require('../../user');
const { getActor } = require('../../activitypub');

const controller = module.exports;

controller.get = async function (req, res, next) {
	const { userslug: uid } = req.params;
	const actor = await getActor(uid);
	if (!actor) {
		return next();
	}
	const { preferredUsername, published, icon, image, name, summary, hostname } = actor;
	const isFollowing = await db.isSortedSetMember(`followingRemote:${req.uid}`, uid);

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
	};

	res.render('account/profile', payload);
};
