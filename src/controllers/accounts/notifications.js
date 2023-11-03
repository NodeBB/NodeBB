'use strict';

const user = require('../../user');
const helpers = require('../helpers');
const plugins = require('../../plugins');
const pagination = require('../../pagination');

const notificationsController = module.exports;

notificationsController.get = async function (req, res, next) {
	const regularFilters = [
		{ name: '[[notifications:all]]', filter: '' },
		{ name: '[[global:topics]]', filter: 'new-topic' },
		{ name: '[[notifications:replies]]', filter: 'new-reply' },
		{ name: '[[notifications:tags]]', filter: 'new-topic-with-tag' },
		{ name: '[[notifications:categories]]', filter: 'new-topic-in-category' },
		{ name: '[[notifications:chat]]', filter: 'new-chat' },
		{ name: '[[notifications:group-chat]]', filter: 'new-group-chat' },
		{ name: '[[notifications:public-chat]]', filter: 'new-public-chat' },
		{ name: '[[notifications:follows]]', filter: 'follow' },
		{ name: '[[notifications:upvote]]', filter: 'upvote' },
		{ name: '[[notifications:awards]]', filter: 'new-reward' },
	];

	const moderatorFilters = [
		{ name: '[[notifications:new-flags]]', filter: 'new-post-flag' },
		{ name: '[[notifications:my-flags]]', filter: 'my-flags' },
		{ name: '[[notifications:bans]]', filter: 'ban' },
	];

	const filter = req.query.filter || '';
	const page = Math.max(1, req.query.page || 1);
	const itemsPerPage = 20;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;

	const [filters, isPrivileged] = await Promise.all([
		plugins.hooks.fire('filter:notifications.addFilters', {
			regularFilters: regularFilters,
			moderatorFilters: moderatorFilters,
			uid: req.uid,
		}),
		user.isPrivileged(req.uid),
	]);

	let allFilters = filters.regularFilters;
	if (isPrivileged) {
		allFilters = allFilters.concat([
			{ separator: true },
		]).concat(filters.moderatorFilters);
	}

	allFilters.forEach((filterData) => {
		filterData.selected = filterData.filter === filter;
	});
	const selectedFilter = allFilters.find(filterData => filterData.selected);
	if (!selectedFilter) {
		return next();
	}

	const data = await user.notifications.getAllWithCounts(req.uid, selectedFilter.filter);
	let notifications = await user.notifications.getNotifications(data.nids, req.uid);

	allFilters.forEach((filterData) => {
		if (filterData && filterData.filter) {
			filterData.count = data.counts[filterData.filter] || 0;
		}
	});

	const pageCount = Math.max(1, Math.ceil(notifications.length / itemsPerPage));
	notifications = notifications.slice(start, stop + 1);

	res.render('notifications', {
		notifications: notifications,
		pagination: pagination.create(page, pageCount, req.query),
		filters: allFilters,
		regularFilters: regularFilters,
		moderatorFilters: moderatorFilters,
		selectedFilter: selectedFilter,
		title: '[[pages:notifications]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:notifications]]' }]),
	});
};
