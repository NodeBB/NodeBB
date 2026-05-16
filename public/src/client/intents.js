'use strict';

export function init() {
	switch(ajaxify.data.intent) {
		case 'create': {
			if (ajaxify.data?.cid) {
				ajaxify.go(`category/${encodeURIComponent(ajaxify.data.cid)}`);
				app.newTopic(ajaxify.data.cid);
			} else if (ajaxify.data?.tid) {
				if (ajaxify.data?.toPid) {
					ajaxify.go(`/post/${encodeURIComponent(ajaxify.data.toPid)}`);
				} else {
					ajaxify.go(`topic/${encodeURIComponent(ajaxify.data.tid)}`);
				}
				app.newReply({ tid: ajaxify.data.tid, toPid: ajaxify.data.toPid });
			}
			break;
		}

		case 'dislike': // intentional fall-through
		case 'like': {
			ajaxify.go(`/post/${encodeURIComponent(ajaxify.data.pid)}`);
			// intents.confirm
			break;
		}

		case 'follow': {
			ajaxify.go(`/uid/${encodeURIComponent(ajaxify.data.uid)}`);
			break;
		}
	}
}
