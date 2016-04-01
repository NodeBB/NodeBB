"use strict";

var async = require('async');

var db = require('../../database');
var groups = require('../../groups');
var categories = require('../../categories');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var Categories = {};

Categories.create = function(socket, data, callback) {
	if (!data) {
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
	categories.purge(cid, socket.uid, callback);
};

Categories.update = function(socket, data, callback) {
	if (!data) {
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

Categories.copyPrivilegesToChildren = function(socket, cid, callback) {
	async.parallel({
		category: function(next) {
			categories.getCategories([cid], socket.uid, next);
		},
		privileges: function(next) {
			privileges.categories.list(cid, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		var category = results.category[0];

		async.eachSeries(category.children, function(child, next) {
			copyPrivilegesToChildrenRecursive(child, results.privileges.groups, next);
		}, callback);
	});
};

function copyPrivilegesToChildrenRecursive(category, privilegeGroups, callback) {
	async.eachSeries(privilegeGroups, function(privGroup, next) {
		var privs = Object.keys(privGroup.privileges);
		async.each(privs, function(privilege, next) {
			var isSet = privGroup.privileges[privilege];
			groups[isSet ? 'join' : 'leave']('cid:' + category.cid + ':privileges:' + privilege, privGroup.name, next);
		}, next);
	}, function(err) {
		if (err) {
			return callback(err);
		}
		async.eachSeries(category.children, function(child, next) {
			copyPrivilegesToChildrenRecursive(child, privilegeGroups, next);
		}, callback);
	});
}

Categories.copySettingsFrom = function(socket, data, callback) {
	categories.copySettingsFrom(data.fromCid, data.toCid, callback);
};

module.exports = Categories;