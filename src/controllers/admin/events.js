'use strict';

const db = require('../../database');
const events = require('../../events');
const pagination = require('../../pagination');
const user = require('../../user');
const groups = require('../../groups');

const eventsController = module.exports;

eventsController.get = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const itemsPerPage = parseInt(req.query.perPage, 10) || 20;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;
	let uids;
	if (req.query.username) {
		uids = [await user.getUidByUsername(req.query.username)];
	} else if (req.query.group) {
		uids = await groups.getMembers(req.query.group, 0, -1);
	}

	// Limit by date
	let from = req.query.start ? new Date(req.query.start) || undefined : undefined;
	let to = req.query.end ? new Date(req.query.end) || undefined : new Date();
	from = from && from.setUTCHours(0, 0, 0, 0); // setHours returns a unix timestamp (Number, not Date)
	to = to && to.setUTCHours(23, 59, 59, 999); // setHours returns a unix timestamp (Number, not Date)

	const currentFilter = req.query.type || '';
	const [eventCount, eventData, counts] = await Promise.all([
		events.getEventCount({
			filter: currentFilter,
			uids,
			from: from || '-inf',
			to,
		}),
		events.getEvents({
			filter: currentFilter,
			uids,
			start,
			stop,
			from: from || '-inf',
			to,
		}),
		db.sortedSetsCard([''].concat(events.types).map(type => `events:time${type ? `:${type}` : ''}`)),
	]);

	const types = [''].concat(events.types).map((type, index) => ({
		value: type,
		name: type || 'all',
		selected: type === currentFilter,
		count: counts[index],
	}));

	const pageCount = Math.max(1, Math.ceil(eventCount / itemsPerPage));

	res.render('admin/advanced/events', {
		events: eventData,
		pagination: pagination.create(page, pageCount, req.query),
		types: types,
		query: req.query,
	});
};
