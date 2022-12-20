'use strict';

import navigationAdmin from '../../navigation/admin';

const SocketNavigation  = {} as any;

SocketNavigation.save = async function (socket, data) {
	await navigationAdmin.save(data);
};

export default SocketNavigation;
