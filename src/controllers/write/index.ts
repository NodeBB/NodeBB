'use strict';

const Write = {} as any;

import users from './users';
import groups from './groups';
import categories from './categories';
import topics from './topics';
import posts from './posts';
import chats from './chats';
import admin from './admin';
import files from './files';
import utilities from './utilities';
import flags from './flags';

Write.users = users;
Write.groups = groups;
Write.categories = categories;
Write.topics = topics;
Write.posts = posts;
Write.chats = chats;
Write.flags = flags;
Write.admin = admin;
Write.files = files;
Write.utilities = utilities;

export default Write;
