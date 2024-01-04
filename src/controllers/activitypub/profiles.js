'use strict';

const { getActor, mockProfile } = require('../../activitypub');

const controller = module.exports;

controller.get = async function (req, res, next) {
	const { userslug: uid } = req.params;
	const actor = await getActor(uid);
	if (!actor) {
		return next();
	}

	const payload = await mockProfile(actor, req.uid);
	res.render('account/profile', payload);
};
