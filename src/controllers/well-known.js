'use strict';

const nconf = require('nconf');

const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const privileges = require('../privileges');

const Controller = module.exports;

Controller.webfinger = async (req, res) => {
	const { resource } = req.query;
	const { host, hostname } = nconf.get('url_parsed');

	if (!resource || !resource.startsWith('acct:') || !resource.endsWith(host)) {
		return res.sendStatus(400);
	}

	// Get the slug
	const slug = resource.slice(5, resource.length - (host.length + 1));
	const [uid, cid] = await Promise.all([
		user.getUidByUserslug(slug),
		categories.getCidByHandle(slug),
	]);
	let response = {
		subject: `acct:${slug}@${host}`,
	};

	try {
		if (slug === hostname) {
			response = application(response);
		} else if (uid) {
			response = await profile(uid, response);
		} else if (cid) {
			response = await category(cid, response);
		} else {
			return res.sendStatus(404);
		}

		res.status(200).json(response);
	} catch (e) {
		res.sendStatus(404);
	}
};

function application(response) {
	response.aliases = [nconf.get('url')];
	response.links = [];

	if (meta.config.activitypubEnabled) {
		response.links.push({
			rel: 'self',
			type: 'application/activity+json',
			href: `${nconf.get('url')}/actor`, // actor
		});
	}

	return response;
}

async function profile(uid, response) {
	const canView = await privileges.global.can('view:users', -2);
	if (!canView) {
		throw new Error('[[error:no-privileges]]');
	}
	const slug = await user.getUserField(uid, 'userslug');

	response.aliases = [
		`${nconf.get('url')}/uid/${uid}`,
		`${nconf.get('url')}/user/${slug}`,
	];

	response.links = [
		{
			rel: 'http://webfinger.net/rel/profile-page',
			type: 'text/html',
			href: `${nconf.get('url')}/user/${slug}`,
		},
	];

	if (meta.config.activitypubEnabled) {
		response.links.push({
			rel: 'self',
			type: 'application/activity+json',
			href: `${nconf.get('url')}/uid/${uid}`, // actor
		});
	}

	return response;
}

async function category(cid, response) {
	const canFind = await privileges.categories.can('find', cid, -2);
	if (!canFind) {
		throw new Error('[[error:no-privileges]]');
	}
	const slug = await categories.getCategoryField(cid, 'slug');

	response.aliases = [`${nconf.get('url')}/category/${slug}`];
	response.links = [];

	if (meta.config.activitypubEnabled) {
		response.links.push({
			rel: 'self',
			type: 'application/activity+json',
			href: `${nconf.get('url')}/category/${cid}`, // actor
		});
	}

	return response;
}
