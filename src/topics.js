var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js')
	categories = require('./categories.js');

(function(Topics) {

	Topics.get_by_category = function(callback, category, start, end) {

	}



	Topics.get = function(callback, category_id, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		//build a proper wrapper for this and move it into above function later
		var range_var = (category_id) ? 'categories:' + category_id + ':tid'  : 'topics:tid';

		RDB.lrange(range_var, start, end, function(tids) {
			var title = [],
				uid = [],
				timestamp = [],
				slug = [],
				postcount = [];

			for (var i=0, ii=tids.length; i<ii; i++) {
				title.push('tid:' + tids[i] + ':title');
				uid.push('tid:' + tids[i] + ':uid');
				timestamp.push('tid:' + tids[i] + ':timestamp');
				slug.push('tid:' + tids[i] + ':slug');
				postcount.push('tid:' + tids[i] + ':postcount');
			}

			var multi = RDB.multi()
				.get('cid:' + category_id + ':name');

			if (tids.length > 0) {
				multi
					.mget(title)
					.mget(uid)
					.mget(timestamp)
					.mget(slug)
					.mget(postcount)
			}
				
			
			multi.exec(function(err, replies) {
				category_name = replies[0];
				var topics = [];

				if (tids.length > 0) {
					title = replies[1];
					uid = replies[2];
					timestamp = replies[3];
					slug = replies[4];
					postcount = replies[5];
					
					
					
					
					user.get_usernames_by_uids(uid, function(userNames) {
						
						for (var i=0, ii=title.length; i<ii; i++) {
							
							topics.push({
								'title' : title[i],
								'uid' : uid[i],
								'username': userNames[i],
								'timestamp' : timestamp[i],
								'relativeTime': utils.relativeTime(timestamp[i]),
								'slug' : slug[i],
								'post_count' : postcount[i]
							});
						}

						callback({
							'category_name' : category_id ? category_name : 'Recent',
							'show_topic_button' : category_id ? 'show' : 'hidden',
							'category_id': category_id,
							'topics': topics
						});
					
					});	
				}
				else {
					callback({
						'category_name' : category_id ? category_name : 'Recent',
						'show_topic_button' : category_id ? 'show' : 'hidden',
						'category_id': category_id,
						'topics': []
					});
				}
				


			});
			//} else callback({'category_id': category_id, 'topics': []});
		});
	}

	Topics.post = function(socket, uid, title, content, category_id) {
		if (!category_id) throw new Error('Attempted to post without a category_id');
		
		if (uid === 0) {
			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'Since you are unregistered, your post is awaiting approval. Click here to register now.',
				type: 'warning',
				timeout: 7500,
				clickfn: function() {
					ajaxify.go('register');
				}
			});
			return; // for now, until anon code is written.
		}
		
		RDB.incr('global:next_topic_id', function(tid) {

			// Global Topics
			if (uid == null) uid = 0;
			if (uid !== null) {
				RDB.lpush('topics:tid', tid);	
			} else {
				// need to add some unique key sent by client so we can update this with the real uid later
				RDB.lpush('topics:queued:tid', tid);
			}
			


			if (category_id) {
				RDB.lpush('categories:' + category_id + ':tid', tid);
			}

			var slug = tid + '/' + utils.slugify(title);

			// Topic Info
			RDB.set('tid:' + tid + ':title', title);
			RDB.set('tid:' + tid + ':uid', uid);
			RDB.set('tid:' + tid + ':slug', slug);
			RDB.set('tid:' + tid + ':timestamp', new Date().getTime());
		
			
			RDB.set('topic:slug:' + slug + ':tid', tid);

			// Posts
			posts.create(uid, tid, content, function(pid) {
				if (pid > 0) RDB.lpush('tid:' + tid + ':posts', pid);
			});


			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':topics', tid);

			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'You have successfully posted. Click here to view your post.',
				type: 'notify',
				timeout: 2000
			});


			// in future it may be possible to add topics to several categories, so leaving the door open here.
			categories.get_category([category_id], function(data) {
				RDB.set('tid:' + tid + ':category_name', data.categories[0].name);
				RDB.set('tid:' + tid + ':category_slug', data.categories[0].slug);
			});

		});

		
	};

}(exports));