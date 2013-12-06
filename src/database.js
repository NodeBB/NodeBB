

var nconf = require('nconf'),
	databaseType = nconf.get('database');

	if(!databaseType) {
		winston.info('Database type not set! Run npm app --setup');
		process.exit();
	}

var db = require('./database/' + databaseType);

module.exports = db;