"use strict";

var blacklistController = {};

blacklistController.get = function(req, res, next) {
	res.render('admin/manage/ip-blacklist', {});
};

module.exports = blacklistController;
