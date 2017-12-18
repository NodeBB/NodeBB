'use strict';

var privileges = module.exports;

privileges.privilegeLabels = [
	{ name: 'Find Category' },
	{ name: 'Access Category' },
	{ name: 'Access Topics' },
	{ name: 'Create Topics' },
	{ name: 'Reply to Topics' },
	{ name: 'Tag Topics' },
	{ name: 'Edit Posts' },
	{ name: 'Delete Posts' },
	{ name: 'Delete Topics' },
	{ name: 'Upload Images' },
	{ name: 'Upload Files' },
	{ name: 'Purge' },
	{ name: 'Moderate' },
];

privileges.userPrivilegeList = [
	'find',
	'read',
	'topics:read',
	'topics:create',
	'topics:reply',
	'topics:tag',
	'posts:edit',
	'posts:delete',
	'topics:delete',
	'upload:post:image',
	'upload:post:file',
	'purge',
	'moderate',
];

privileges.groupPrivilegeList = privileges.userPrivilegeList.map(function (privilege) {
	return 'groups:' + privilege;
});

privileges.privilegeList = privileges.userPrivilegeList.concat(privileges.groupPrivilegeList);

require('./privileges/global')(privileges);
require('./privileges/categories')(privileges);
require('./privileges/topics')(privileges);
require('./privileges/posts')(privileges);
require('./privileges/users')(privileges);
