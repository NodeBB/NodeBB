var path = require('path');
var sockets = require('path');
var websockets = require('../socket.io/');
var continuationLocalStorage = require('continuation-local-storage');
var APP_NAMESPACE = require(path.join(__dirname, '../../package.json')).name;
var namespace = continuationLocalStorage.createNamespace(APP_NAMESPACE);

(function(cls) {
	cls.http = function (req, res, next) {
		namespace.run(function() {
			namespace.set('request', req);
			next && next();
		});
	};

	cls.socket = function (socket, payload, event, next) {
		namespace.run(function() {
			namespace.set('request', websockets.reqFromSocket(socket, payload, event));
			next && next();
		});
	};

	cls.get = function (key) {
		return namespace.get(key);
	};

	cls.set = function (key, value) {
		return namespace.set(key, value);
	};

	cls.setItem = cls.set;
	cls.getItem = cls.set;
	cls.namespace = namespace;
	cls.continuationLocalStorage = continuationLocalStorage;

})(exports);


