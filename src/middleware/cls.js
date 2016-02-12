var path = require('path');
var continuationLocalStorage = require('continuation-local-storage');
var APP_NAMESPACE = require(path.join(__dirname, '../../package.json')).name;
var namespace = continuationLocalStorage.createNamespace(APP_NAMESPACE);

var cls = {};

cls.http = function (req, res, next) {
	namespace.run(function() {
		namespace.set('http', {req: req, res: res});
		next();
	});
};

cls.socket = function (socket, payload, event, next) {
	namespace.run(function() {
		namespace.set('ws', {
			socket: socket,
			payload: payload,
			// if it's a '*' event, then we grab it from the payload
			event: event || ((payload || {}).data || [])[0]});
		next();
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
cls.getNamespace = cls.storage;
cls.namespace = namespace;
cls.continuationLocalStorage = continuationLocalStorage;

module.exports = cls;


