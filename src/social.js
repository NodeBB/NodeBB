'use strict';

var async = require('async');
var plugins = require('./plugins');
var db = require('./database');

var social = module.exports;

social.postSharing = null;

social.getPostSharing = function (callback) {
	if (social.postSharing) {
		return setImmediate(callback, null, social.postSharing);
	}

	var networks = [
		{
			id: 'facebook',
			name: 'Facebook',
			class: 'fa-facebook',
		},
		{
			id: 'twitter',
			name: 'Twitter',
			class: 'fa-twitter',
		},
		{
			id: 'google',
			name: 'Google+',
			class: 'fa-google-plus',
		},
	];

	async.waterfall([
		function (next) {
			plugins.fireHook('filter:social.posts', networks, next);
		},
		function (networks, next) {
			db.getSetMembers('social:posts.activated', next);
		},
		function (activated, next) {
			networks.forEach(function (network) {
				network.activated = activated.includes(network.id);
			});

			social.postSharing = networks;
			next(null, networks);
		},
	], callback);
};

social.getActivePostSharing = function (callback) {
	async.waterfall([
		function (next) {
			social.getPostSharing(next);
		},
		function (networks, next) {
			networks = networks.filter(network => network && network.activated);
			next(null, networks);
		},
	], callback);
};

social.setActivePostSharingNetworks = function (networkIDs, callback) {
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
		},
	], callback);
};
