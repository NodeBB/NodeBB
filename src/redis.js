(function(RedisDB) {
	var	redis = require('redis'),
		utils = require('./../public/src/utils.js');
	
	RedisDB.exports = redis.createClient(global.nconf.get('redis:port'), global.nconf.get('redis:host'));

	if( global.nconf.get('redis:password') ) {
		RedisDB.exports.auth(global.nconf.get('redis:password'));
	}

	RedisDB.exports.handle = function(error) {
		if (error !== null) {
			if (global.env !== 'production') {
				console.log("################# ERROR LOG ####################");
				console.log(error);
				console.log(arguments.callee.name);
				console.log("################# ERROR LOG ####################");
				throw new Error(error);
			} else {
				console.log(error);
			}
		}
	}


	/*
	* A possibly more efficient way of doing multiple sismember calls
	*/
	RedisDB.exports.sismembers = function(key, needles, callback) {
		var tempkey = key + ':temp:' + utils.generateUUID();
		RedisDB.exports.sadd(tempkey, needles, function() {
			RedisDB.exports.sinter(key, tempkey, function(err, data) {
				RedisDB.exports.del(tempkey);
				callback(err, data);
			});
		});
	};

	/*
	 * gets fields of a hash as an object instead of an array
	 */
	RedisDB.exports.hmgetObject = function (key, fields, callback) {
		RedisDB.exports.hmget(key, fields, function(err, data) {
			if(err === null) {
				var returnData = {};
				
				for(var i=0, ii=fields.length; i<ii; ++i) {
					returnData[fields[i]] = data[i];
				}

				callback(null, returnData);
			}
			else {
				console.log(err);
				callback(err, null);
			}
		});		
	}	



}(module));