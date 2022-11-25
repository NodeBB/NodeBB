'use strict';

const privileges  = {} as any;

privileges.global = require('./global').default;
privileges.admin = require('./admin').default;
privileges.categories = require('./categories').default;
privileges.topics = require('./topics').default;
privileges.posts = require('./posts').default;
privileges.users = require('./users').default;

privileges.init = async () => {
	await privileges.global.init();
	await privileges.admin.init();
	await privileges.categories.init();
};

require('../promisify').promisify(privileges);

export default privileges;