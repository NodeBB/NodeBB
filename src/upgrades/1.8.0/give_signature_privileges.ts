'use strict';

import privileges from '../../privileges';



export const obj = {
	name: 'Give registered users signature privilege',
	timestamp: Date.UTC(2018, 1, 28),
	method: function (callback) {
		privileges.global.give(['groups:signature'], 'registered-users', callback);
	},
};
