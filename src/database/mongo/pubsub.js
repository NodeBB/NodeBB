'use strict';

var mubsub = require('mubsub-nbb');
var db = require('../mongo');
const connString = db.getConnectionString();
const connOptions = db.getConnectionOptions();
var client = mubsub(connString, connOptions);
client.on('error', function (err) {
	console.error('mongo pubsub error ' + connString, connOptions, err);
});
module.exports = client.channel('pubsub');
