'use strict';

var mubsub = require('mubsub-nbb');
var db = require('../mongo');
const connString = db.getConnectionString();

var client = mubsub(connString);
client.on('error', function (err) {
	console.error('mongo pubsub error ' + connString, err);
});
module.exports = client.channel('pubsub');
