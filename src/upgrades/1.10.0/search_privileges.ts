'use strict';
import meta from '../../meta';


export default  {
	name: 'Give global search privileges',
	timestamp: Date.UTC(2018, 4, 28),
	method: async function () {
		const privileges = require('../../privileges');
		const allowGuestSearching = parseInt(meta.configs.allowGuestSearching, 10) === 1;
		const allowGuestUserSearching = parseInt(meta.configs.allowGuestUserSearching, 10) === 1;

		await privileges.global.give(['groups:search:content', 'groups:search:users', 'groups:search:tags'], 'registered-users');
		const guestPrivs : any[] = [];
		if (allowGuestSearching) {
			guestPrivs.push('groups:search:content');
		}
		if (allowGuestUserSearching) {
			guestPrivs.push('groups:search:users');
		}
		guestPrivs.push('groups:search:tags');
		await privileges.global.give(guestPrivs, 'guests');
	},
};
