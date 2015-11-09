"use strict";

var topics = require('../../topics');

var tagsController = {};

tagsController.get = function(req, res, next) {
	topics.getTags(0, 199, function(err, tags) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/tags', {tags: tags});
	});
};


module.exports = tagsController;
