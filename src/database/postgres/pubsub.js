'use strict';

const util = require('util');
const winston = require('winston');
const EventEmitter = require('events').EventEmitter;
const pg = require('pg');
const connection = require('./connection');

const PubSub = function () {
	const self = this;

	const subClient = new pg.Client(connection.getConnectionOptions());

	subClient.connect(function (err) {
		if (err) {
			winston.error(err);
			return;
		}

		subClient.query('LISTEN pubsub', function (err) {
			if (err) {
				winston.error(err);
			}
		});

		subClient.on('notification', function (message) {
			if (message.channel !== 'pubsub') {
				return;
			}

			try {
				var msg = JSON.parse(message.payload);
				self.emit(msg.event, msg.data);
			} catch (err) {
				winston.error(err.stack);
			}
		});
	});
};

util.inherits(PubSub, EventEmitter);

PubSub.prototype.publish = function (event, data) {
	const db = require('../postgres');
	db.pool.query({
		name: 'pubSubPublish',
		text: `SELECT pg_notify('pubsub', $1::TEXT)`,
		values: [JSON.stringify({ event: event, data: data })],
	});
};

module.exports = new PubSub();
