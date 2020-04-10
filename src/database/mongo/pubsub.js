'use strict';

const mubsub = require('@nodebb/mubsub');
const connection = require('./connection');

const client = mubsub(connection.getConnectionString(), connection.getConnectionOptions());
client.on('error', err => console.error(err));
const channel = client.channel('pubsub');
channel.on('error', err => console.error(err));
module.exports = channel;
