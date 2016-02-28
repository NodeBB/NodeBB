"use strict";

var plugins = require('./plugins');
var db = require('./database');
var async = require('async');

var social = {};

social.getPostSharing = function(callback) {
	var networks = [
		{
			id: "facebook",
			name: "Facebook",
			class: "fa-facebook"
		},
		{
			id: "twitter",
			name: "Twitter",
			class: "fa-twitter"
		},
		{
			id: "google",
			name: "Google+",
			class: "fa-google-plus"
		}
	];

	async.waterfall([
		function(next) {
			plugins.fireHook('filter:social.posts', networks, next);
		},
		function(networks, next) {
			db.getSetMembers('social:posts.activated', function(err, activated) {
				if (err) {
					return next(err);
				}

				networks.forEach(function(network, i) {
					networks[i].activated = (activated.indexOf(network.id) !== -1);
				});

				next(null, networks);
			});
		}
	], callback);
};

social.setActivePostSharingNetworks = function(networkIDs, callback) {
	db.delete('social:posts.activated', function(err) {
		if (!networkIDs.length) {
			return callback(err);
		}

		db.setAdd('social:posts.activated', networkIDs, callback);
	});
};

module.exports = social;