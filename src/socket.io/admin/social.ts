'use strict';

import social from '../../social';

const SocketSocial  = {} as any;

SocketSocial.savePostSharingNetworks = async function (socket, data) {
	await social.setActivePostSharingNetworks(data);
};

export default SocketSocial;