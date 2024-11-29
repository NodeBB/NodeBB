// SPDX-FileCopyrightText: 2013-2021 NodeBB Inc
//
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

module.exports = {
	admin: require('./admin'),
	users: require('./users'),
	groups: require('./groups'),
	topics: require('./topics'),
	tags: require('./tags'),
	posts: require('./posts'),
	chats: require('./chats'),
	categories: require('./categories'),
	search: require('./search'),
	flags: require('./flags'),
	files: require('./files'),
	utils: require('./utils'),
};
