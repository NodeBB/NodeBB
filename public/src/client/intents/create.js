'use strict';

export function init() {
	if (ajaxify.data?.cid) {
		ajaxify.go(`category/${ajaxify.data.cid}`);
		app.newTopic(ajaxify.data.cid);
	} else if (ajaxify.data?.tid) {
		if (ajaxify.data?.toPid) {
			ajaxify.go(`/post/${ajaxify.data.toPid}`);
		} else {
			ajaxify.go(`topic/${ajaxify.data.tid}`);
		}
		app.newReply({ tid: ajaxify.data.tid, toPid: ajaxify.data.toPid });
	}
}
