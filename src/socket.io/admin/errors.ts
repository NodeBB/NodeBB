'use strict';

import meta from '../../meta';

const Errors  = {} as any;

Errors.clear = async function () {
	await meta.errors.clear();
};

export default Errors;
