'use strict';

const mubsub = require('mubsub-nbb');
const connection = require('./connection');
const client = mubsub(connection.getConnectionString(), connection.getConnectionOptions());

module.exports = client.channel('pubsub');
