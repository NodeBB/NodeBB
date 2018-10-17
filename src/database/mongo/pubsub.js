'use strict';

var mubsub = require('mubsub-nbb');
var db = require('../mongo');
var client = mubsub(db.getConnectionString(), db.getConnectionOptions());

module.exports = client.channel('pubsub');
