'use strict';

var express = require('express');
var nconf = require('nconf');

module.exports = function (app) {
	var router = express.Router();

	router.get('/test', async function (req, res) {
		// res.redirect(404);
		const groups = require('../groups');

		// const d1 = await groups.getOwnersAndMembers('GNU/Linux User', 1, 0, 9);
		// const d2 = await groups.getOwnersAndMembers('GNU/Linux User', 1, 10, 19);
		// const d3 = await groups.getOwnersAndMembers('GNU/Linux User', 1, 0, 19);
		const d4 = await groups.getOwnersAndMembers('GNU/Linux User', 1, 45, 51);


		// const uids1 = d1.map(d => d.uid);
		// const uids2 = d2.map(d => d.uid);
		res.json({
			// uids1: uids1,
			// uids2: uids2,
			// uids3: d3.map(d => d.uid),
			uids4: d4.map(d => d.uid),
			len4: d4.length,
		});
	});

	app.use(nconf.get('relative_path') + '/debug', router);
};
