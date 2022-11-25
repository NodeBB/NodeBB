'use strict';

const async = require('async');
import * as database from '../../database';
const db = database as any;


export default  {
	name: 'Social: Post Sharing',
	timestamp: Date.UTC(2016, 1, 25),
	method: function (callback) {
		const social = require('../../social');
		async.parallel([
			function (next) {
				social.setActivePostSharingNetworks(['facebook', 'google', 'twitter'], next);
			},
			function (next) {
				db.deleteObjectField('config', 'disableSocialButtons', next);
			},
		], callback);
	},
};
