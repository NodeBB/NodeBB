"use strict";

var topics = require('../../topics'),
	Tags = {};

Tags.update = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.updateTag(data.tag, data, callback);
};


module.exports = Tags;