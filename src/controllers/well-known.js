'use strict';

const nconf = require('nconf');

const user = require('../user');
const privileges = require('../privileges');

const Controller = module.exports;

Controller.webfinger = async (req, res) => {
	const { resource } = req.query;
	const { hostname } = nconf.get('url_parsed');

	if (!resource || !resource.startsWith('acct:') || !resource.endsWith(hostname)) {
		return res.sendStatus(400);
	}

	const canView = await privileges.global.can('view:users', req.uid);
	console.log('canView', canView, req.uid);
	if (!canView) {
		return res.sendStatus(403);
	}

	// Get the slug
	const slug = resource.slice(5, resource.length - (hostname.length + 1));

	const uid = await user.getUidByUserslug(slug);
	if (!uid) {
		return res.sendStatus(404);
	}

	const response = {
		subject: `acct:${slug}@${hostname}`,
		aliases: [
			`${nconf.get('url')}/uid/${uid}`,
			`${nconf.get('url')}/user/${slug}`,
		],
		links: [
			{
				rel: 'http://webfinger.net/rel/profile-page',
				type: 'text/html',
				href: `${nconf.get('url')}/user/${slug}`,
			},
		],
	};

	res.status(200).json(response);
};
