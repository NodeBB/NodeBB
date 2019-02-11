'use strict';

var async = require('async');

var categories = require('../../categories');
var plugins = require('../../plugins');
var events = require('../../events');

var Categories = module.exports;

Categories.create = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
};

Categories.getAll = function (socket, data, callback) {
	async.waterfall([
		async.apply(categories.getAllCidsFromSet, 'categories:cid'),
		async.apply(categories.getCategoriesData),
		function (categories, next) {
			// Hook changes, there is no req, and res
			plugins.fireHook('filter:admin.categories.get', { categories: categories }, next);
		},
		function (result, next) {
			next(null, categories.getTree(result.categories, 0));
		},
	], callback);
};

Categories.getNames = function (socket, data, callback) {
	categories.getAllCategoryFields(['cid', 'name'], callback);
};

Categories.purge = function (socket, cid, callback) {
	var name;
	async.waterfall([
		function (next) {
			categories.getCategoryField(cid, 'name', next);
		},
		function (_name, next) {
			name = _name;
			categories.purge(cid, socket.uid, next);
		},
		function (next) {
			events.log({
				type: 'category-purge',
				uid: socket.uid,
				ip: socket.ip,
				cid: cid,
				name: name,
			});
			setImmediate(next);
		},
	], callback);
};

Categories.update = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.update(data, callback);
};

Categories.copySettingsFrom = function (socket, data, callback) {
	categories.copySettingsFrom(data.fromCid, data.toCid, true, callback);
};
