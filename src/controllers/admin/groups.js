'use strict';

const nconf = require('nconf');
const validator = require('validator');

const db = require('../../database');
const user = require('../../user');
const groups = require('../../groups');
const meta = require('../../meta');
const pagination = require('../../pagination');
const events = require('../../events');

const groupsController = module.exports;

groupsController.list = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const groupsPerPage = 20;

	let groupNames = await getGroupNames();
	const pageCount = Math.ceil(groupNames.length / groupsPerPage);
	const start = (page - 1) * groupsPerPage;
	const stop = start + groupsPerPage - 1;
	groupNames = groupNames.slice(start, stop + 1);

	const groupData = await groups.getGroupsData(groupNames.map(g => g.name));
	res.render('admin/manage/groups', {
		groups: groupData,
		pagination: pagination.create(page, pageCount),
		yourid: req.uid,
	});
};

groupsController.get = async function (req, res, next) {
	const lowercaseSlug = req.params.slug.toLowerCase();
	if (req.params.slug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.slug = lowercaseSlug;
		} else {
			return res.redirect(`${nconf.get('relative_path')}/admin/manage/groups/${lowercaseSlug}`);
		}
	}

	const groupName = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!groupName) {
		return next();
	}
	const [groupNames, group] = await Promise.all([
		getGroupNames(),
		groups.get(groupName, { uid: req.uid, truncateUserList: true, userListCount: 20 }),
	]);

	if (!group || groupName === groups.BANNED_USERS) {
		return next();
	}

	const groupNameData = groupNames.map(g => ({
		encodedName: encodeURIComponent(g.name),
		displayName: validator.escape(String(g.name)),
		slug: g.slug,
		selected: g.name === groupName,
	}));

	res.render('admin/manage/group', {
		group: group,
		groupNames: groupNameData,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		maximumGroupNameLength: meta.config.maximumGroupNameLength,
		maximumGroupTitleLength: meta.config.maximumGroupTitleLength,
	});
};

async function getGroupNames() {
	let groupEntries = Object.entries(await db.getObject('groupslug:groupname'));
	groupEntries = groupEntries.map(g => ({ slug: g[0], name: g[1] }));
	return groupEntries.filter(g => (
		g.name !== 'registered-users' &&
		g.name !== 'verified-users' &&
		g.name !== 'unverified-users' &&
		g.name !== groups.BANNED_USERS
	)).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

groupsController.getCSV = async function (req, res) {
	const { referer } = req.headers;

	if (!referer || !referer.replace(nconf.get('url'), '').startsWith('/admin/manage/groups')) {
		return res.status(403).send('[[error:invalid-origin]]');
	}
	await events.log({
		type: 'getGroupCSV',
		uid: req.uid,
		ip: req.ip,
		group: req.params.groupname,
	});
	const groupName = req.params.groupname;
	const members = (await groups.getMembersOfGroups([groupName]))[0];
	const fields = ['email', 'username', 'uid'];
	const userData = await user.getUsersFields(members, fields);
	let csvContent = `${fields.join(',')}\n`;
	csvContent += userData.reduce((memo, user) => {
		memo += `${user.email},${user.username},${user.uid}\n`;
		return memo;
	}, '');

	res.attachment(`${validator.escape(groupName)}_members.csv`);
	res.setHeader('Content-Type', 'text/csv');
	res.end(csvContent);
};
