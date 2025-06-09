'use strict';

const validator = require('validator');
const db = require('../../database');
const events = require('../../events');
const pagination = require('../../pagination');

const eventsController = module.exports;

eventsController.get = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const itemsPerPage = parseInt(req.query.perPage, 10) || 20;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;

	// Limit by date
	let from = req.query.start ? new Date(req.query.start) || undefined : undefined;
	let to = req.query.end ? new Date(req.query.end) || undefined : new Date();
	from = from && from.setHours(0, 0, 0, 0); // setHours returns a unix timestamp (Number, not Date)
	to = to && to.setHours(23, 59, 59, 999); // setHours returns a unix timestamp (Number, not Date)

	const currentFilter = req.query.type || '';

	const [eventCount, eventData, counts] = await Promise.all([
		db.sortedSetCount(`events:time${currentFilter ? `:${currentFilter}` : ''}`, from || '-inf', to),
		events.getEvents(currentFilter, start, stop, from || '-inf', to),
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
		query: {
			start: validator.escape(String(req.query.start)),
			end: validator.escape(String(req.query.end)),
			username: validator.escape(String(req.query.username)),
			group: validator.escape(String(req.query.group)),
			perPage: validator.escape(String(req.query.perPage)),
		},
	});
};
