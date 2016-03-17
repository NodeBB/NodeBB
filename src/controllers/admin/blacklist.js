"use strict";

var meta = require('../../meta');

var blacklistController = {};

blacklistController.get = function(req, res, next) {
	meta.blacklist.get(function(err, rules) {
		if (err) {
			return next(err);
		}
		res.render('admin/manage/ip-blacklist', {rules: rules, title: 'IP Blacklist'});
	});
};

module.exports = blacklistController;
