
'use strict';

var async = require('async'),

	user = require('../user'),
	helpers = require('./helpers');


module.exports = function(privileges) {

	privileges.categories = {};

	privileges.categories.canRead = function(cid, uid, callback) {
		helpers.some([
			function(next) {
				helpers.allowedTo('read', uid, cid, next);
			},
			function(next) {
				user.isModerator(uid, cid, next);
			},
			function(next) {
				user.isAdministrator(uid, next);
			}
		], callback);
	};

};
