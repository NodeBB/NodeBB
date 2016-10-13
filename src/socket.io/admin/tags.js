"use strict";

var topics = require('../../topics');
var Tags = {};

Tags.create = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.createEmptyTag(data.tag, callback);
};

Tags.update = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.updateTag(data.tag, data, callback);
};

Tags.deleteTags = function (socket, data, callback) {
	topics.deleteTags(data.tags, callback);
};


module.exports = Tags;