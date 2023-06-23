'use strict';

const { getActor } = require('../../activitypub');

const controller = module.exports;

controller.get = async function (req, res, next) {
	const { userslug: uid } = req.params;
	const actor = await getActor(uid);
	if (!actor) {
		return next();
	}
	const { preferredUsername, published, icon, image, name, summary, hostname } = actor;
	const payload = {
		uid,
		username: `${preferredUsername}@${hostname}`,
		userslug: `${preferredUsername}@${hostname}`,
		fullname: name,
		joindate: new Date(published).getTime(),
		picture: typeof icon === 'string' ? icon : icon.url,
		uploadedpicture: typeof icon === 'string' ? icon : icon.url,
		'cover:url': !image || typeof image === 'string' ? image : image.url,
		'cover:position': '50% 50%',
		aboutme: summary,
		aboutmeParsed: summary,
	};

	res.render('account/profile', payload);
};
