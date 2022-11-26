'use strict';

import { primaryDB as db } from '../../database';
import meta from '../../meta';

export default  {
	name: 'Rename maximumImageWidth to resizeImageWidth',
	timestamp: Date.UTC(2018, 9, 24),
	method: async function () {
		const value = await meta.configs.get('maximumImageWidth');
		await meta.configs.set('resizeImageWidth', value);
		await db.deleteObjectField('config', 'maximumImageWidth');
	},
};
