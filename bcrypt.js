
'use strict';

var bcrypt = require('bcryptjs'),
	async = require('async'),
	action = process.argv[2];

switch(action) {
	case 'compare':
			bcrypt.compare(process.argv[3], process.argv[4], function(err, res) {
				process.stdout.write(res ? 'true' : 'false');
			});
		break;

	case 'hash':
			async.waterfall([
				async.apply(bcrypt.genSalt, parseInt(process.argv[3], 10)),
				function(salt, next) {
					bcrypt.hash(process.argv[4], salt, next);
				}
			], function(err, hash) {
				if (!err) {
					process.stdout.write(hash);
				} else {
					process.stderr.write(err.message);
				}
			});
		break;
}