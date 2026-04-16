'use strict';

const db = require('../database');
const analytics = require('../analytics');

const activitypub = module.parent.exports;

const Analytics = module.exports;

Analytics.receipt = async ({ id, type, actor }) => {
	const now = Date.now();
	const { hostname } = new URL(actor);

	await Promise.all([
		db.sortedSetAdd(`activities:datetime`, now, id),
		activitypub.instances.log(hostname),
		analytics.increment(['activities', `activities:byType:${type}`, `activities:byHost:${hostname}`]),
	]);
};

Analytics.send = async ({ type, target }) => {
	const { hostname } = new URL(target);

	await Promise.all([
		activitypub.instances.log(hostname),
		analytics.increment(['ap.out', `ap.out:byType:${type}`, `ap.out:byHost:${hostname}`]),
	]);
};

Analytics.sendError = async ({ payload, uri, error }) => {
	const { id } = payload;
	const now = Date.now();
	const { hostname } = new URL(uri);
	await Promise.all([
		db.sortedSetAdd('ap.errors', now, id),
		db.setObject(`ap.errors:${id}`, {
			type: 'out',
			body: JSON.stringify(payload),
			stack: error.message,
		}),
		analytics.increment(['ap.outErr', `ap.outErr:byType:${payload.type}`, `ap.outErr:byHost:${hostname}`]),
	]);
	await db.expire(`ap.errors:${id}`, 60 * 60 * 24); // 24 hours
};

Analytics.receiptError = async (body, error) => {
	const { id, actor } = body;
	const now = Date.now();
	const { hostname } = new URL(actor);
	await Promise.all([
		db.sortedSetAdd('ap.errors', now, id),
		db.setObject(`ap.errors:${id}`, {
			type: 'in',
			body: JSON.stringify(body),
			stack: error.stack,
		}),
		analytics.increment(['ap.inErr', `ap.inErr:byHost:${hostname}`]),
	]);
	await db.expire(`ap.errors:${id}`, 60 * 60 * 24); // 24 hours
};

Analytics.relays = {};

Analytics.relays.in = (relay) => {
	const { hostname } = new URL(relay);
	analytics.increment(['ap.relayIn', `ap.relayIn:byHost:${hostname}`]);
};

Analytics.relays.out = (relay) => {
	const { hostname } = new URL(relay);
	analytics.increment(['ap.relayOut', `ap.relayOut:byHost:${hostname}`]);
};