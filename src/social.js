"use strict";

var plugins = require('./plugins');
var db = require('./database');
var async = require('async');

var social = {};

social.postSharing = null;

social.getPostSharing = function(callback) {
	if (social.postSharing) {
		return callback(null, social.postSharing);
	}

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

				social.postSharing = networks;
				next(null, networks);
			});
		}
	], callback);
};

social.getActivePostSharing = function(callback) {
	social.getPostSharing(function(err, networks) {
		if (err) {
			return callback(err);
		}
		networks = networks.filter(function(network) {
			return network && network.activated;
		});
		callback(null, networks);
	});
};

social.setActivePostSharingNetworks = function(networkIDs, callback) {
	async.waterfall([
		function (next) {
			db.delete('social:posts.activated', next);
		},
		function (next) {
			if (!networkIDs.length) {
				return next();
			}
			db.setAdd('social:posts.activated', networkIDs, next);
		},
		function (next) {
			social.postSharing = null;
			next();
		}
	], callback);
};

module.exports = social;