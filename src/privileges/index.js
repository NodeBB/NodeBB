'use strict';

var privileges = module.exports;

privileges.privilegeLabels = [
	{ name: '[[admin/manage/privileges:find-category]]' },
	{ name: '[[admin/manage/privileges:access-category]]' },
	{ name: '[[admin/manage/privileges:access-topics]]' },
	{ name: '[[admin/manage/privileges:create-topics]]' },
	{ name: '[[admin/manage/privileges:reply-to-topics]]' },
	{ name: '[[admin/manage/privileges:tag-topics]]' },
	{ name: '[[admin/manage/privileges:edit-posts]]' },
	{ name: '[[admin/manage/privileges:view-edit-history]]' },
	{ name: '[[admin/manage/privileges:delete-posts]]' },
	{ name: '[[admin/manage/privileges:upvote-posts]]' },
	{ name: '[[admin/manage/privileges:downvote-posts]]' },
	{ name: '[[admin/manage/privileges:delete-topics]]' },
	{ name: '[[admin/manage/privileges:view_deleted]]' },
	{ name: '[[admin/manage/privileges:purge]]' },
	{ name: '[[admin/manage/privileges:moderate]]' },
];

privileges.userPrivilegeList = [
	'find',
	'read',
	'topics:read',
	'topics:create',
	'topics:reply',
	'topics:tag',
	'posts:edit',
	'posts:history',
	'posts:delete',
	'posts:upvote',
	'posts:downvote',
	'topics:delete',
	'posts:view_deleted',
	'purge',
	'moderate',
];

privileges.groupPrivilegeList = privileges.userPrivilegeList.map(function (privilege) {
	return 'groups:' + privilege;
});

privileges.privilegeList = privileges.userPrivilegeList.concat(privileges.groupPrivilegeList);

require('./global')(privileges);
require('./categories')(privileges);
require('./topics')(privileges);
require('./posts')(privileges);
require('./users')(privileges);

privileges.async = require('../promisify')(privileges);
