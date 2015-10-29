"use strict";

var coverPhoto = {};
var meta = require('./meta');
var nconf = require('nconf');


coverPhoto.getDefaultCover = function(groupName) {
	return getCover('groups', groupName);
};

function getCover(type, id) {
	var covers = meta.config[type + ':defaultCovers'].split(/\s*?,\s*?/g);
	
	if (typeof id === 'string') {
		id = (id.charCodeAt(0) + id.charCodeAt(1)) % covers.length;
	} else {
		id = id % covers.length;
	}

	return covers && covers.length ? covers[id] : (nconf.get('relative_path') + '/images/cover-default.png');
}

module.exports = coverPhoto;