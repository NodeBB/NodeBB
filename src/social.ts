'use strict';

const _ = require('lodash');
const plugins = require('./plugins');
import * as database from './database';      
    
const db = database as any;

const social  = {} as any;

social.postSharing = null;

social.getPostSharing = async function () {
	if (social.postSharing) {
		return _.cloneDeep(social.postSharing);
	}

	let networks = [
		{
			id: 'facebook',
			name: 'Facebook',
			class: 'fa-facebook',
		},
		{
			id: 'twitter',
			name: 'Twitter',
			class: 'fa-twitter',
		},
	] as any[];
	networks = await plugins.hooks.fire('filter:social.posts', networks);
	// @ts-ignore
	const activated = await db.getSetMembers('social:posts.activated');
	networks.forEach((network) => {
		network.activated = activated.includes(network.id);
	});

	social.postSharing = networks;
	return _.cloneDeep(networks);
};

social.getActivePostSharing = async function () {
	const networks = await social.getPostSharing();
	return networks.filter(network => network && network.activated);
};

social.setActivePostSharingNetworks = async function (networkIDs) {
	social.postSharing = null;
		// @ts-ignore
	await db.delete('social:posts.activated');
	if (!networkIDs.length) {
		return;
	}
	// @ts-ignore
	await db.setAdd('social:posts.activated', networkIDs);
};

require('./promisify').promisify(social);

export default social;
