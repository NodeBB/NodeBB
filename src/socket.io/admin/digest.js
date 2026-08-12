'use strict';

const meta = require('../../meta');
const userDigest = require('../../user/digest');

const Digest = module.exports;

Digest.resend = async (socket, data) => {
	const { uid } = data;
	const interval = data.action.startsWith('resend-') ?
		data.action.slice(7) :
		await userDigest.getUsersInterval(uid);

	if (!interval && meta.config.dailyDigestFreq === 'off') {
		throw new Error('[[error:digest-not-enabled]]');
	}
	let intervalToUse = interval || meta.config.dailyDigestFreq;
	if (intervalToUse === 'off') {
		intervalToUse = 'month';
	}
	if (uid) {
		await userDigest.execute({
			interval: intervalToUse,
			subscribers: [uid],
		});
	} else {
		await userDigest.execute({ interval: intervalToUse });
	}
};
