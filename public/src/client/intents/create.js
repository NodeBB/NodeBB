'use strict';

export function init() {
	if (ajaxify.data?.cid) {
		ajaxify.go(`category/${ajaxify.data.cid}`);
		app.newTopic(ajaxify.data.cid);
	} else if (ajaxify.data?.tid) {
		ajaxify.go(`topic/${ajaxify.data.tid}`);
		if (ajaxify.data?.toPid) {
			app.newReply({ tid: ajaxify.data.tid, toPid: ajaxify.data.toPid });
		} else {
			app.newReply({ tid: ajaxify.data.tid });
		}
	}
}
