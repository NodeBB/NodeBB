'use strict';

import profile from './accounts/profile';
import edit from './accounts/edit';
import info from './accounts/info';
import categories from './accounts/categories';
import settings from './accounts/settings';
import groups from './accounts/groups';
import follow from './accounts/follow';
import posts from './accounts/posts';
import notifications from './accounts/notifications';
import chats from './accounts/chats';
import sessions from './accounts/sessions';
import blocks from './accounts/blocks';
import uploads from './accounts/uploads';
import consent from './accounts/consent';

const accountsController = {
	profile,
	edit,
	info,
	categories,
	settings,
	groups,
	follow,
	posts,
	notifications,
	chats,
	sessions,
	blocks,
	uploads,
	consent,
};

export default  accountsController;
