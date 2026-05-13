'use strict';

const validator = require('validator');

const db = require('../../database');
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
	const urls = relays.map(({ url }) => url);

	let { relay, term } = req.query;
	if (!urls.includes(relay)) {
		relay = undefined;
	}
	let method = 'getHourlyStatsForSet';
	let count = 24;
	if (term === 'daily') {
		method = 'getDailyStatsForSet';
		count = 30;
	}
	const inSet = relay ? `ap.relayIn:byRelay:${relay}` : 'ap.relayIn';
	const outSet = relay ? `ap.relayOut:byRelay:${relay}` : 'ap.relayOut';
	const incoming = await analytics[method](inSet, Date.now(), count);
	const out = await analytics[method](outSet, Date.now(), count);

	res.render(`admin/federation/relays`, {
		title: '[[admin/menu:federation/relays]]',
		relays,
		data: { in: incoming, out },
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
	instances.sort();

	let { host, term } = req.query;
	if (!instances.includes(host)) {
		host = undefined;
	}
	let method = 'getHourlyStatsForSet';
	let count = 24;
	if (term === 'daily') {
		method = 'getDailyStatsForSet';
		count = 30;
	}
	const receivedSet = host ? `activities:byHost:${host}` : 'activities';
	const receivedErrSet = host ? `ap.inErr:byHost:${host}` : 'ap.inErr';
	const sentSet = host ? `ap.out:byHost:${host}` : 'ap.out';
	const sentErrSet = host ? `ap.outErr:byHost:${host}` : 'ap.outErr';
	const received = await analytics[method](receivedSet, Date.now(), count);
	const receivedErr = await analytics[method](receivedErrSet, Date.now(), count);
	const sent = await analytics[method](sentSet, Date.now(), count);
	const sentErr = await analytics[method](sentErrSet, Date.now(), count);

	res.render('admin/federation/analytics', {
		title: '[[admin/menu:federation/analytics]]',
		instances,
		data: {
			received,
			receivedErr,
			sent,
			sentErr,
		},
		hideSave: 1,
	});
};

federationController.errors = async function (req, res) {
	let errors = await db.getSortedSetRevRangeByScoreWithScores('ap.errors', 0, -1, Date.now(), '-inf');
	const errorObj = await db.getObjects(errors.map(({ value: id }) => `ap.errors:${id}`));
	errors = errors.map(({ value: id, score: timestamp }, idx) => {
		if (!errorObj[idx]) {
			return null;
		}
		let { type, body, stack } = errorObj[idx];
		let activityType;
		let hostname = 'Invalid hostname';
		const timestampISO = new Date(timestamp).toISOString();
		try {
			const parsed = JSON.parse(body);
			({ type: activityType } = parsed);
			body = JSON.stringify(parsed, null, 4);
			stack = validator.escape(stack.replace(/\s+$/gm, ''));
			({ hostname } = new URL(id));
		} catch (e) {
			// noop
		}

		return {
			id: validator.escape(String(id || '')),
			type: validator.escape(String(type || '')),
			activityType: validator.escape(String(activityType || '')),
			body: validator.escape(String(body || '')),
			stack,
			hostname,
			timestamp,
			timestampISO,
		};
	}).filter(Boolean);

	res.render('admin/federation/errors', {
		title: '[[admin/menu:federation/errors]]',
		errors,
	});
};
