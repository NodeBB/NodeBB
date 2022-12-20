'use strict';

import async from 'async';
import db from '../../database';
import social from '../../social';

export const  obj = {
	name: 'Social: Post Sharing',
	timestamp: Date.UTC(2016, 1, 25),
	method: function (callback) {
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
