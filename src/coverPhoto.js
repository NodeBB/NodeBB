'use strict';


const nconf = require('nconf');
const meta = require('./meta');

const relative_path = nconf.get('relative_path');

const coverPhoto = module.exports;

coverPhoto.getDefaultGroupCover = function (groupName) {
	return getCover('groups', groupName);
};

coverPhoto.getDefaultProfileCover = function (uid) {
	return getCover('profile', parseInt(uid, 10));
};

function getCover(type, id) {
	const defaultCover = `${relative_path}/assets/images/cover-default.png`;
	if (meta.config[`${type}:defaultCovers`]) {
		const covers = String(meta.config[`${type}:defaultCovers`]).trim().split(/[\s,]+/g);
		let coverPhoto = defaultCover;
		if (!covers.length) {
			return coverPhoto;
		}

		if (typeof id === 'string') {
			id = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
		} else {
			id %= covers.length;
		}
		if (covers[id]) {
			coverPhoto = covers[id].startsWith('http') ? covers[id] : (relative_path + covers[id]);
		}
		return coverPhoto;
	}

	return defaultCover;
}
