

var nconf = require('nconf');
	db = require('./databases/' + nconf.get('database'));

module.exports = db;