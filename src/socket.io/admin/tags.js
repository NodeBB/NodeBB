'use strict';

var topics = require('../../topics');

var Tags = module.exports;

Tags.create = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.createEmptyTag(data.tag, callback);
};

Tags.update = function (socket, data, callback) {
	if (!Array.isArray(data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.updateTags(data, callback);
};

Tags.rename = function (socket, data, callback) {
	if (!Array.isArray(data)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.renameTags(data, callback);
};

Tags.deleteTags = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.deleteTags(data.tags, callback);
};
