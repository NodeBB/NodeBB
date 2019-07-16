'use strict';

var Settings = module.exports;

var async = require('async');
var meta = require('../../meta');
var events = require('../../events');

Settings.get = function (socket, data, callback) {
	meta.settings.get(data.hash, callback);
};

Settings.set = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			meta.settings.set(data.hash, data.values, next);
		},
		function (next) {
			var eventData = data.values;
			eventData.type = 'settings-change';
			eventData.uid = socket.uid;
			eventData.ip = socket.ip;
			eventData.hash = data.hash;
			events.log(eventData, next);
		},
	], callback);
};

Settings.clearSitemapCache = function (socket, data, callback) {
	require('../../sitemap').clearCache();
	callback();
};
