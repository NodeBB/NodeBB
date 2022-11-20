'use strict';

import meta from '../../meta';

export default  {
	name: 'Re-enable username login',
	timestamp: Date.UTC(2021, 10, 23),
	method: async () => {
		const setting = await meta.configs.allowLoginWith;

		if (setting === 'email') {
			await meta.configs.set('allowLoginWith', 'username-email');
		}
	},
};
