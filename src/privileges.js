"use strict";

var privileges = {};

privileges.userPrivilegeList = [
	'find',
	'read',
	'topics:read',
	'topics:create',
	'topics:reply',
	'upload:post:image',
	'upload:post:file',
	'purge',
	'mods'
];

privileges.groupPrivilegeList = [
	'groups:find',
	'groups:read',
	'groups:topics:read',
	'groups:topics:create',
	'groups:topics:reply',
	'groups:upload:post:image',
	'groups:upload:post:file',
	'groups:purge',
	'groups:moderate'
];

privileges.privilegeList = privileges.userPrivilegeList.concat(privileges.groupPrivilegeList);

require('./privileges/categories')(privileges);
require('./privileges/topics')(privileges);
require('./privileges/posts')(privileges);
require('./privileges/users')(privileges);

module.exports = privileges;