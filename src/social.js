'use strict';

const _ = require('lodash');
const plugins = require('./plugins');
const db = require('./database');
const meta = require('./meta');

const social = module.exports;

social.postSharing = null;

social.getPostSharing = async function () {
	if (social.postSharing) {
		return _.cloneDeep(social.postSharing);
	}

	let networks = [
		{
			id: 'facebook',
			name: 'Facebook',
			class: 'fa-brands fa-facebook',
		},
		{
			id: 'twitter',
			name: 'X (Twitter)',
			class: 'fa-brands fa-x-twitter',
		},
		{
			id: 'whatsapp',
			name: 'Whatsapp',
			class: 'fa-brands fa-whatsapp',
		},
		{
			id: 'telegram',
			name: 'Telegram',
			class: 'fa-brands fa-telegram',
		},
		{
			id: 'linkedin',
			name: 'LinkedIn',
			class: 'fa-brands fa-linkedin',
		},
	];
	networks = await plugins.hooks.fire('filter:social.posts', networks);
	networks.forEach((network) => {
		network.activated = parseInt(meta.config[`post-sharing-${network.id}`], 10) === 1;
	});

	social.postSharing = networks;
	return _.cloneDeep(networks);
};

social.getActivePostSharing = async function () {
	const networks = await social.getPostSharing();
	return networks.filter(network => network && network.activated);
};

social.setActivePostSharingNetworks = async function (networkIDs) {
	// keeping for 1.0.0 upgrade script that uses this function
	social.postSharing = null;
	if (!networkIDs.length) {
		return;
	}
	const data = {};
	networkIDs.forEach((id) => {
		data[`post-sharing-${id}`] = 1;
	});
	await db.setObject('config', data);
};

require('./promisify')(social);
