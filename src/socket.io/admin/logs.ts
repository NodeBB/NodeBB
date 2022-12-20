'use strict';

import meta from '../../meta';

const Logs  = {} as any;

Logs.get = async function () {
	return await meta.logs.get();
};

Logs.clear = async function () {
	await meta.logs.clear();
};

export default Logs;
