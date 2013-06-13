(function() {
	var cid = templates.get('category_id'),
		room = 'category_' + cid;
		
	app.enter_room(room);

	var new_post = document.getElementById('new_post');
	new_post.onclick = function() {
		require(['composer'], function(cmp) {
		    cmp.push(0, cid);
		});
	}

	ajaxify.register_events([
		'event:new_topic'
	]);

	socket.on('event:new_topic', function(data) {
		var html = templates.prepare(templates['category'].blocks['topics']).parse({ topics: [data] }),
			topic = document.createElement('div'),
			container = document.getElementById('topics-container'),
			topics = document.querySelectorAll('#topics-container a'),
			numTopics = topics.length,
			x;

		jQuery('#topics-container, .category-sidebar').removeClass('hidden');
		jQuery('#category-no-topics').remove();

		topic.innerHTML = html;
		if (numTopics > 0) {
			for(x=0;x<numTopics;x++) {
				if (topics[x].querySelector('.icon-pushpin')) continue;
				container.insertBefore(topic.querySelector('a'), topics[x]);
				$(topic).hide().fadeIn('slow');
				break;
			}
		} else {
			container.insertBefore(topic.querySelector('a'), null);
			$(topic).hide().fadeIn('slow');
		}

		// jQuery('<div></div>').appendTo("#topics-container").hide().append(html).fadeIn('slow');	
		// set_up_posts(uniqueid);
	});



	socket.emit('api:categories.getRecentReplies', cid);
	socket.on('api:categories.getRecentReplies', function(replies) {
		if (replies === false) {
			return;
		}
		
		var users = replies.users,
			posts = replies.posts,
			recent_replies = document.getElementById('category_recent_replies');

		recent_replies.innerHTML = '';
		for (var i=0, ii=posts.pids.length; i<ii; i++) {
			var a = document.createElement('a'),
				ul = document.createElement('ul'),
				username = users[posts.uid[i]].username,
				picture = users[posts.uid[i]].picture;

			//temp until design finalized
			ul.innerHTML = '<li><img title="' + username + '" style="width: 48px; height: 48px; /*temporary*/" src="' + picture + '" class="" />'
							+ '<p><strong>' + username + '</strong>: ' + posts.content[i] + '</p><span>posted ' + utils.relativeTime(posts.timestamp[i]) + ' ago</span></li>';
			
			a.appendChild(ul);
			recent_replies.appendChild(a);
		}
		
	});

})();