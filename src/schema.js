(function(Schema) {


	Schema.global = function() {
		return {

			/* strings */
			next_topic_id: 'next_topic_id'

		}
	};

	Schema.topics = function(tid) {
		return {

			/* strings */
			title: 'tid:' + tid + ':title',
			locked: 'tid:' + tid + ':locked',
			category_name: 'tid:' + tid + ':category_name',
			category_slug: 'tid:' + tid + ':category_slug',
			deleted: 'tid:' + tid + ':deleted',
			pinned: 'tid:' + tid + ':pinned',
			uid: 'tid:' + tid + ':uid',
			timestamp: 'tid:' + tid + ':timestamp',
			slug: 'tid:' + tid + ':slug',
			postcount: 'tid:' + tid + ':postcount',
			cid: 'tid:' + tid + ':cid',

			/* sets */
			tid: 'topics:tid',
			read_by_uid: 'tid:' + tid + ':read_by_uid',

			/* sorted sets */
			recent: 'topics:recent',

			/* lists */
			posts: 'tid:' + tid + ':posts',
			queued_tids: 'topics:queued:tid',


			slug: function(slug) {
				return {
					tid: 'topic:slug:' + slug + ':tid'
				}
			}

		}
	};

	Schema.categories = function(cid) {

	};

	Schema.users = function(uid) {

	};

	Schema.posts = function(pid) {

	};


}(module.exports));