'use strict';

var mubsub = require('mubsub-nbb');
var db = require('../mongo');

var client = mubsub(db.getConnectionString(), db.getConnectionOptions());
client.on('error', function (err) {
	console.error('mongo pubsub error', err);
});
module.exports = client.channel('pubsub');
