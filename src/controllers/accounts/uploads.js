'use strict';


var async = require('async');
var nconf = require('nconf');

var db = require('../../database');
var helpers = require('../helpers');
var meta = require('../../meta');
var pagination = require('../../pagination');
var accountHelpers = require('./helpers');

var uploadsController = module.exports;

uploadsController.get = function (req, res, callback) {
	var userData;

	var page = Math.max(1, parseInt(req.query.page, 10) || 1);
	var itemsPerPage = 25;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			var start = (page - 1) * itemsPerPage;
			var stop = start + itemsPerPage - 1;
			async.parallel({
				itemCount: function (next) {
					db.sortedSetCard('uid:' + userData.uid + ':uploads', next);
				},
				uploadNames: function (next) {
					db.getSortedSetRevRange('uid:' + userData.uid + ':uploads', start, stop, next);
				},
			}, next);
		},
		function (results) {
			userData.uploads = results.uploadNames.map(function (uploadName) {
				return {
					name: uploadName,
					url: nconf.get('upload_url') + uploadName,
				};
			});
			var pageCount = Math.ceil(results.itemCount / itemsPerPage);
			userData.pagination = pagination.create(page, pageCount, req.query);
			userData.privateUploads = parseInt(meta.config.privateUploads, 10) === 1;
			userData.title = '[[pages:account/uploads, ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[global:uploads]]' }]);
			res.render('account/uploads', userData);
		},
	], callback);
};
