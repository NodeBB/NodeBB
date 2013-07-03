(function() {
	var cid = templates.get('category_id'),
		room = 'category_' + cid,
		twitterEl = document.getElementById('twitter-intent'),
		facebookEl = document.getElementById('facebook-share'),
		googleEl = document.getElementById('google-share'),
		twitter_url = templates.get('twitter-intent-url'),
		facebook_url = templates.get('facebook-share-url'),
		google_url = templates.get('google-share-url');
		
	app.enter_room(room);

	twitterEl.addEventListener('click', function() {
		window.open(twitter_url, '_blank', 'width=550,height=420,scrollbars=no,status=no');
	}, false);
	facebookEl.addEventListener('click', function() {
		window.open(facebook_url, '_blank', 'width=626,height=436,scrollbars=no,status=no');
	}, false);
	googleEl.addEventListener('click', function() {
		window.open(google_url, '_blank', 'width=500,height=570,scrollbars=no,status=no');
	}, false);

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
		topic = topic.querySelector('a');
		
		if (numTopics > 0) {
			for(x=0;x<numTopics;x++) {
				if (topics[x].querySelector('.icon-pushpin')) continue;
				container.insertBefore(topic, topics[x]);
				$(topic).hide().fadeIn('slow');
				break;
			}
		} else {
			container.insertBefore(topic, null);
			$(topic).hide().fadeIn('slow');
		}

		ajaxify.enable();
	});


	socket.emit('api:categories.getRecentReplies', cid);
	socket.on('api:categories.getRecentReplies', function(posts) {
		if (!posts || posts.length === 0) {
			return;
		}
		
		var recent_replies = document.getElementById('category_recent_replies');

		recent_replies.innerHTML = '';
		
		for (var i=0, ii=posts.length; i<ii; i++) {
			
			var a = document.createElement('a'),
				ul = document.createElement('ul'),
				username = posts[i].username,
				picture = posts[i].picture;

			ul.innerHTML = '<li><img title="' + username + '" style="width: 48px; height: 48px; /*temporary*/" src="' + picture + '" class="" />'
							+ '<p><strong>' + username + '</strong>: ' + posts[i].content + '</p><span>posted ' + utils.relativeTime(posts[i].timestamp) + ' ago</span></li>';
			
			a.appendChild(ul);
			recent_replies.appendChild(a);
		}
		
	});

})();