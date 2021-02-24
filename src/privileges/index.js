'use strict';

const privileges = module.exports;
privileges.global = require('./global');
privileges.admin = require('./admin');
privileges.categories = require('./categories');
privileges.topics = require('./topics');
privileges.posts = require('./posts');
privileges.users = require('./users');

require('../promisify')(privileges);

// TODO: backwards compatibility remove in 1.18.0
[
	'privilegeLabels',
	'userPrivilegeList',
	'groupPrivilegeList',
	'privilegeList',
].forEach((fieldName) => {
	Object.defineProperty(privileges, fieldName, {
		configurable: true,
		enumerable: true,
		get: function () {
			console.warn(`[deprecated] privileges.${fieldName} is deprecated. Use privileges.categories.${fieldName}`);
			return privileges.categories[fieldName];
		},
	});
});
