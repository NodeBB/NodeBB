'use strict';

const async = require('async');

const categories = require('../../categories');
const groups = require('../../groups');
const events = require('../../events');
const privileges = require('../../privileges');

const Privileges = module.exports;

Privileges.setPrivilege = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (Array.isArray(data.privilege)) {
		async.each(data.privilege, function (privilege, next) {
			groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + privilege, data.member, next);
		}, onSetComplete);
	} else {
		groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + data.privilege, data.member, onSetComplete);
	}

	function onSetComplete() {
		events.log({
			uid: socket.uid,
			type: 'privilege-change',
			ip: socket.ip,
			privilege: data.privilege.toString(),
			cid: data.cid,
			action: data.set ? 'grant' : 'rescind',
			target: data.member,
		}, callback);
	}
};

Privileges.getPrivilegeSettings = function (socket, cid, callback) {
	if (cid === 'acp') {
		privileges.admin.list(callback);
	} else if (!parseInt(cid, 10)) {
		privileges.global.list(callback);
	} else {
		privileges.categories.list(cid, callback);
	}
};

Privileges.copyPrivilegesToChildren = function (socket, cid, callback) {
	async.waterfall([
		function (next) {
			categories.getChildren([cid], socket.uid, next);
		},
		function (children, next) {
			children = children[0];

			async.eachSeries(children, function (child, next) {
				copyPrivilegesToChildrenRecursive(cid, child, next);
			}, next);
		},
	], callback);
};

function copyPrivilegesToChildrenRecursive(parentCid, category, callback) {
	async.waterfall([
		function (next) {
			categories.copyPrivilegesFrom(parentCid, category.cid, next);
		},
		function (next) {
			async.eachSeries(category.children, function (child, next) {
				copyPrivilegesToChildrenRecursive(parentCid, child, next);
			}, next);
		},
	], callback);
}

Privileges.copyPrivilegesFrom = function (socket, data, callback) {
	categories.copyPrivilegesFrom(data.fromCid, data.toCid, callback);
};
