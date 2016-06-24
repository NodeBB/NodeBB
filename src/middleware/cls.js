var path = require('path');
var sockets = require('path');
var utils = require('../../public/src/utils');
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
			var req = utils.reqFromSocket(socket, payload, event);
			namespace.set('request', req);
			next && next();
		});
	};

	cls.get = function (key) {
		return namespace.get(key);
	};

	cls.set = function (key, value) {
		return namespace.set(key, value);
	};

	cls.bind = function (fn) {
		return namespace.bind(fn || function (){});
	};

	cls.bindEmitter = function (ee) {
		return namespace.bindEmitter(ee);
	};

	cls.bindDB = function (db) {
		cls.bindObject(db);
		cls.bindObject(db.helpers);
	};

	cls.bindObject = function (obj) {
		for (var prop in obj) {
			if (obj.hasOwnProperty(prop) && typeof obj[prop] === 'function') {
				obj[prop] = cls.wrapCallback(obj[prop]);
			}
		}
		return obj;
	}

	cls.wrapCallback = function (func, context) {
		return (function() {
			var oldFunc = func;

			return function () {
				var args = argsToArray(arguments);
				var last = args.length - 1;
	      var callback = args[last];

	      if (typeof callback === 'function') {
	        args[last] = cls.bind(callback);
				}
				return oldFunc.apply(context || this, args);
			}
		})();
	};

	cls.setItem = cls.set;
	cls.getItem = cls.get;
	cls.namespace = namespace;
	cls.continuationLocalStorage = continuationLocalStorage;

	// faster than [].slice.call
	// https://github.com/othiym23/cls-redis/blob/62a2d27a919f6ed124cba972bbeb9ad3d7bdf973/shim.js
	function argsToArray(args) {
  	var length = args.length, array = [], i;
  	for (i = 0; i < length; i++) array[i] = args[i];
  	return array;
	}

})(exports);
