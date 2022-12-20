'use strict';

const privileges = {} as any;

import global from './global';
import admin from './admin';
import categories from './categories';
import topics from './topics';
import posts from './posts';
import users from './users';


Object.assign(privileges, {
	global,
	admin,
	categories,
	topics,
	posts,
	users,
});

privileges.init = async () => {
	await privileges.global.init();
	await privileges.admin.init();
	await privileges.categories.init();
};

import promisify from '../promisify';
promisify(privileges);

export default privileges;
