(function () {
	var cid = templates.get('category_id'),
		room = 'category_' + cid,
		twitterEl = document.getElementById('twitter-intent'),
		facebookEl = document.getElementById('facebook-share'),
		googleEl = document.getElementById('google-share'),
		twitter_url = templates.get('twitter-intent-url'),
		facebook_url = templates.get('facebook-share-url'),
		google_url = templates.get('google-share-url'),
		loadingMoreTopics = false;

	app.enter_room(room);

	twitterEl.addEventListener('click', function () {
		window.open(twitter_url, '_blank', 'width=550,height=420,scrollbars=no,status=no');
		return false;
	}, false);
	facebookEl.addEventListener('click', function () {
		window.open(facebook_url, '_blank', 'width=626,height=436,scrollbars=no,status=no');
		return false;
	}, false);
	googleEl.addEventListener('click', function () {
		window.open(google_url, '_blank', 'width=500,height=570,scrollbars=no,status=no');
		return false;
	}, false);

	var new_post = document.getElementById('new_post');
	new_post.onclick = function () {
		require(['composer'], function (cmp) {
			cmp.push(0, cid);
		});
	}

	ajaxify.register_events([
		'event:new_topic'
	]);

	function onNewTopic(data) {
		var html = templates.prepare(templates['category'].blocks['topics']).parse({
			topics: [data]
		}),
			topic = $(html),
			container = $('#topics-container'),
			topics = $('#topics-container').children(),
			numTopics = topics.length;

		jQuery('#topics-container, .category-sidebar').removeClass('hidden');
		jQuery('#category-no-topics').remove();

		if (numTopics > 0) {
			for (var x = 0; x < numTopics; x++) {
				if ($(topics[x]).find('.icon-pushpin').length)
					continue;
				topic.insertBefore(topics[x]);
				topic.hide().fadeIn('slow');
				break;
			}
		} else {
			container.append(topic);
			topic.hide().fadeIn('slow');
		}

		socket.emit('api:categories.getRecentReplies', cid);
		$('#topics-container span.timeago').timeago();
	}

	socket.on('event:new_topic', onNewTopic);

	socket.emit('api:categories.getRecentReplies', cid);
	socket.on('api:categories.getRecentReplies', function (posts) {
		if (!posts || posts.length === 0) {
			return;
		}

		var recent_replies = document.getElementById('category_recent_replies');

		recent_replies.innerHTML = '';

		var frag = document.createDocumentFragment(),
			li = document.createElement('li');
		for (var i = 0, numPosts = posts.length; i < numPosts; i++) {

			li.setAttribute('data-pid', posts[i].pid);


			li.innerHTML = '<a href="/user/' + posts[i].userslug + '"><img title="' + posts[i].username + '" style="width: 48px; height: 48px; /*temporary*/" class="img-rounded" src="' + posts[i].picture + '" class="" /></a>' +
				'<a href="/topic/' + posts[i].topicSlug + '#' + posts[i].pid + '">' +
				'<p>' +
				posts[i].content +
				'</p>' +
				'<p class="meta"><strong>' + posts[i].username + '</strong></span> -<span class="timeago" title="' + posts[i].relativeTime + '"></span></p>' +
				'</a>';

			frag.appendChild(li.cloneNode(true));
			recent_replies.appendChild(frag);
		}
		$('#category_recent_replies span.timeago').timeago();
	});

	function onTopicsLoaded(topics) {

		var html = templates.prepare(templates['category'].blocks['topics']).parse({
			topics: topics
		}),
			container = $('#topics-container');

		jQuery('#topics-container, .category-sidebar').removeClass('hidden');
		jQuery('#category-no-topics').remove();

		container.append(html);

		$('#topics-container span.timeago').timeago();
	}


	function loadMoreTopics(cid) {
		loadingMoreTopics = true;
		socket.emit('api:category.loadMore', {
			cid: cid,
			after: $('#topics-container').children().length
		}, function (data) {
			if (data.topics.length) {
				onTopicsLoaded(data.topics);
			}
			loadingMoreTopics = false;
		});
	}

	$(window).off('scroll').on('scroll', function (ev) {
		var bottom = ($(document).height() - $(window).height()) * 0.9;

		if ($(window).scrollTop() > bottom && !loadingMoreTopics) {
			loadMoreTopics(cid);
		}
	});


})();