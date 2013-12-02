

var nconf = require('nconf');
	db = require('./database/' + nconf.get('database'));

module.exports = db;