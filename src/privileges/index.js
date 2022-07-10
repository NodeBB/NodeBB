'use strict';

const privileges = module.exports;
privileges.global = require('./global');
privileges.admin = require('./admin');
privileges.categories = require('./categories');
privileges.topics = require('./topics');
privileges.posts = require('./posts');
privileges.users = require('./users');

privileges.init = async () => {
	await privileges.global.init();
	await privileges.admin.init();
	await privileges.categories.init();
};

require('../promisify')(privileges);
