'use strict';

import widgets from '../../widgets';

const Widgets  = {} as any;

Widgets.set = async function (socket, data) {
	if (!Array.isArray(data)) {
		throw new Error('[[error:invalid-data]]');
	}
	await widgets.setAreas(data);
};

export default Widgets;
