"use strict";

var coverPhoto = {};
var meta = require('./meta');
var nconf = require('nconf');


coverPhoto.getDefaultGroupCover = function(groupName) {
	return getCover('groups', groupName);
};

coverPhoto.getDefaultProfileCover = function(uid) {
	return getCover('profile', parseInt(uid, 10));
};

function getCover(type, id) {
	if (meta.config[type + ':defaultCovers']) {		
		var covers = meta.config[type + ':defaultCovers'].split(/\s*?,\s*?/g);
		
		if (typeof id === 'string') {
			id = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
		} else {
			id = id % covers.length;
		}

		return covers[id];
	}

	return nconf.get('relative_path') + '/images/cover-default.png';
}

module.exports = coverPhoto;