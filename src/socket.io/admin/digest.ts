'use strict';

import meta from '../../meta';
const userDigest = require('../../user/digest');

const Digest  = {} as any;

Digest.resend = async (socket, data) => {
	const { uid } = data;
	const interval = data.action.startsWith('resend-') ? data.action.slice(7) : await userDigest.getUsersInterval(uid);

	if (!interval && meta.configs.dailyDigestFreq === 'off') {
		throw new Error('[[error:digest-not-enabled]]');
	}

	if (uid) {
		await userDigest.execute({
			interval: interval || meta.configs.dailyDigestFreq,
			subscribers: [uid],
		});
	} else {
		await userDigest.execute({ interval: interval });
	}
};
