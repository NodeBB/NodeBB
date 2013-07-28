(function(Schema) {


	Schema.global = function() {
		return {

			/* strings */
			next_topic_id: 'next_topic_id'

		}
	};

	Schema.topics = function(tid) {
		return {

			/* sets */
			read_by_uid: 'tid:' + tid + ':read_by_uid',

			/* sorted sets */
			recent: 'topics:recent',

			/* lists */
			posts: 'tid:' + tid + ':posts',
			queued_tids: 'topics:queued:tid',

		}
	};

	Schema.categories = function(cid) {

	};

	Schema.users = function(uid) {

	};

	Schema.posts = function(pid) {

	};


}(module.exports));