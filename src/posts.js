var	RDB = require('./redis.js');

(function(Posts) {
	//data structure
	//*global:next_post_id
	// *pid:1:content
	// *pid:1:uid
	// *pid:1:timestamp
	// ***pid:1:replies
	// *uid:1:posts



	Posts.get = function(topic) {

	}


	Posts.reply = function() {

	};

	Posts.create = function(content, callback) {
		if (global.uid === null) return;

		RDB.incr('global:next_post_id', function(pid) {
			// Posts Info
			RDB.set('pid:' + pid + ':content', content);
			RDB.set('pid:' + pid + ':uid', global.uid);
			RDB.set('pid:' + pid + ':timestamp', new Date().getTime());
			
			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':posts', pid);
			
			if (callback) callback(pid);
		});

	}

}(exports));