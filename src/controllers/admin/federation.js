'use strict';

const activitypub = require('../../activitypub');
const analytics = require('../../analytics');

const federationController = module.exports;

federationController.general = function (req, res) {
	res.render(`admin/federation/general`, {
		title: '[[admin/menu:federation/general]]',
	});
};

federationController.content = function (req, res) {
	res.render(`admin/federation/content`, {
		title: '[[admin/menu:federation/content]]',
	});
};

federationController.rules = async function (req, res) {
	const rules = await activitypub.rules.list();

	res.render(`admin/federation/rules`, {
		title: '[[admin/menu:federation/rules]]',
		rules,
		hideSave: true,
	});
};

federationController.relays = async function (req, res) {
	const relays = await activitypub.relays.list();

	res.render(`admin/federation/relays`, {
		title: '[[admin/menu:federation/relays]]',
		relays,
		hideSave: true,
	});
};

federationController.pruning = function (req, res) {
	res.render(`admin/federation/pruning`, {
		title: '[[admin/menu:federation/pruning]]',
	});
};

federationController.safety = async function (req, res) {
	const instanceCount = await activitypub.instances.getCount();
	const blocklists = await activitypub.blocklists.list();

	res.render(`admin/federation/safety`, {
		title: '[[admin/menu:federation/safety]]',
		blocklists,
		instanceCount,
	});
};

federationController.analytics = async function (req, res) {
	const instances = await activitypub.instances.list();
	let { host } = req.query;
	if (!instances.includes(host)) {
		host = undefined;
	}
	const set = host ? `activities:byHost:${host}` : 'activities';
	const sentSet = host ? `ap.out:byHost:${host}` : 'ap:out';
	const received = await analytics.getHourlyStatsForSet(set, Date.now(), 24);
	const sent = await analytics.getHourlyStatsForSet(sentSet, Date.now(), 24);

	res.render('admin/federation/analytics', {
		title: '[[admin/menu:federation/analytics]]',
		instances,
		received,
		sent,
	});
};
