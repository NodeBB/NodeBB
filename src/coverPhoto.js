'use strict';


var nconf = require('nconf');
var meta = require('./meta');

var coverPhoto = module.exports;

coverPhoto.getDefaultGroupCover = function (groupName) {
	return getCover('groups', groupName);
};

coverPhoto.getDefaultProfileCover = function (uid) {
	return getCover('profile', parseInt(uid, 10));
};

function getCover(type, id) {
	if (meta.config[type + ':defaultCovers']) {
		var covers = meta.config[type + ':defaultCovers'].trim().split(/[\s,]+/g);

		if (typeof id === 'string') {
			id = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
		} else {
			id %= covers.length;
		}
		if (!covers[id].startsWith('http')) {
			covers = nconf.get('relative_path') + covers[id];
		}
		return covers;
	}

	return nconf.get('relative_path') + '/assets/images/cover-default.png';
}
