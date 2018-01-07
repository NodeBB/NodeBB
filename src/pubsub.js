'use strict';

var nconf = require('nconf');

module.exports = nconf.get('redis') ? require('./database/redis').pubsub : require('./database').pubsub;
