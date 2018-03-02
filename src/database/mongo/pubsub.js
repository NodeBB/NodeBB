'use strict';

var mubsub = require('mubsub');

var db = require('../mongo');
var client = mubsub(db.client);

module.exports = client.channel('pubsub');
