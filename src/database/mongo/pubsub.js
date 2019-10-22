'use strict';

const mubsub = require('mubsub-nbb');
const connection = require('./connection');

const client = mubsub(connection.getConnectionString(), connection.getConnectionOptions());
client.on('error', err => console.error(err));
const channel = client.channel('pubsub');
channel.on('error', err => console.error(err));
module.exports = channel;
