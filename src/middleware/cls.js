
var continuationLocalStorage = require('continuation-local-storage');

var NAMESPACE = 'nodebb';
var namespace = continuationLocalStorage.createNamespace(NAMESPACE);

var cls = function (req, res, next) {
	namespace.run(function() {
		var routeData = {req: req, res: res};

		if (process.env.NODE_ENV == 'development') {
			routeData.audit = {created: process.hrtime()};
		}
		namespace.set('route', routeData);
		next();
	});
};

cls.storage = function () {
	return cls.getNamespace(NAMESPACE);
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


