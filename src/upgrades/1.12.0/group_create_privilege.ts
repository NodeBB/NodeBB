'use strict';

const privileges = require('../../privileges');
import meta from '../../meta';


export default  {
	name: 'Group create global privilege',
	timestamp: Date.UTC(2019, 0, 4),
	method: function (callback) {
		if (parseInt(meta.config.allowGroupCreation, 10) === 1) {
			privileges.global.give(['groups:group:create'], 'registered-users', callback);
		} else {
			setImmediate(callback);
		}
	},
};
