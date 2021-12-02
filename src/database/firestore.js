'use strict';

const nconf = require('nconf');

const firestoreModule = module.exports;

firestoreModule.questions = [
	{
		name: 'firestore:database',
		description: 'Firestore session store: (leave blank if you wish to specify host, port, username/password and database individually)\nFormat: mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]',
		default: nconf.get('firestore:database') || '',
		hideOnWebInstall: true,
	},
];
