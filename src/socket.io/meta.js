var	meta = require('../meta'),
	user = require('../user'),

	SocketMeta = {};

SocketMeta.buildTitle = function(text, callback) {
	meta.title.build(text, function(err, title) {
		callback(title);
	});
};

SocketMeta.updateHeader = function(data, callback, sessionData) {
	console.log('HERE', data);
	if (sessionData.uid) {
		user.getUserFields(sessionData.uid, data.fields, function(err, fields) {
			if (!err && fields) {
				fields.uid = sessionData.uid;
				callback(fields);
			}
		});
	} else {
		callback({
			uid: 0,
			username: "Anonymous User",
			email: '',
			picture: gravatar.url('', {
				s: '24'
			}, nconf.get('https')),
			config: {
				allowGuestSearching: meta.config.allowGuestSearching
			}
		});
	}
};

/* Exports */

module.exports = SocketMeta;