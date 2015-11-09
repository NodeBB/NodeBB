"use strict";

var async = require('async'),

	db = require('../../database'),
	groups = require('../../groups'),
	user = require('../../user'),
	categories = require('../../categories'),
	privileges = require('../../privileges'),
	plugins = require('../../plugins'),
	Categories = {};

Categories.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
};

Categories.getAll = function(socket, data, callback) {
	async.waterfall([
		async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
		async.apply(categories.getCategoriesData),
		function(categories, next) {
			//Hook changes, there is no req, and res
			plugins.fireHook('filter:admin.categories.get', {categories: categories}, next);
		},
		function(result, next){
			next(null, categories.getTree(result.categories, 0));
		}
	], function(err, categoriesTree) {
		if (err) {
			return callback(err);
		}

		callback(null, categoriesTree);
	});
};

Categories.getNames = function(socket, data, callback) {
	categories.getAllCategoryFields(['cid', 'name'], callback);
};

Categories.purge = function(socket, cid, callback) {
	categories.purge(cid, callback);
};

Categories.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.update(data, callback);
};

Categories.setPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (Array.isArray(data.privilege)) {
		async.each(data.privilege, function(privilege, next) {
			groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + privilege, data.member, next);
		}, callback);
	} else {
		groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + data.privilege, data.member, callback);
	}
};

Categories.getPrivilegeSettings = function(socket, cid, callback) {
	privileges.categories.list(cid, callback);
};

module.exports = Categories;