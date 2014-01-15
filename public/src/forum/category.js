define(['composer'], function(composer) {
	var Category = {},
		loadingMoreTopics = false;

	Category.init = function() {
		var	cid = templates.get('category_id'),
			categoryName = templates.get('category_name'),
			twitterEl = jQuery('#twitter-intent'),
			facebookEl = jQuery('#facebook-share'),
			googleEl = jQuery('#google-share'),
			categoryUrl = encodeURIComponent(window.location.href),
			twitterUrl = "https://twitter.com/intent/tweet?url=" + categoryUrl + "&text=" + encodeURIComponent(categoryName),
			facebookUrl = "https://www.facebook.com/sharer/sharer.php?u=" + categoryUrl,
			googleUrl = "https://plus.google.com/share?url=" + categoryUrl;

		app.enterRoom('category_' + cid);



		twitterEl.on('click', function () {
			window.open(twitterUrl, '_blank', 'width=550,height=420,scrollbars=no,status=no');
			return false;
		});
		facebookEl.on('click', function () {
			window.open(facebookUrl, '_blank', 'width=626,height=436,scrollbars=no,status=no');
			return false;
		});
		googleEl.on('click', function () {
			window.open(googleUrl, '_blank', 'width=500,height=570,scrollbars=no,status=no');
			return false;
		});

		$('#new_post').on('click', function () {
			composer.newTopic(cid);
		});

		ajaxify.register_events([
			'event:new_topic'
		]);

		socket.on('event:new_topic', Category.onNewTopic);

		socket.emit('api:categories.getRecentReplies', cid, renderRecentReplies);

		$(window).off('scroll').on('scroll', function (ev) {
			var bottom = ($(document).height() - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !loadingMoreTopics) {
				Category.loadMoreTopics(cid);
			}
		});
	};

	Category.onNewTopic = function(data) {
		var html = templates.prepare(templates['category'].blocks['topics']).parse({
			topics: [data]
		});

		translator.translate(html, function(translatedHTML) {
			var topic = $(translatedHTML),
				container = $('#topics-container'),
				topics = $('#topics-container').children('.category-item'),
				numTopics = topics.length;

			jQuery('#topics-container, .category-sidebar').removeClass('hidden');
			jQuery('#category-no-topics').remove();

			if (numTopics > 0) {
				for (var x = 0; x < numTopics; x++) {
					if ($(topics[x]).find('.fa-thumb-tack').length) {
						if(x === numTopics - 1) {
							topic.insertAfter(topics[x]);
						}
						continue;
					}
					topic.insertBefore(topics[x]);
					break;
				}
			} else {
				container.append(topic);
			}

			topic.hide().fadeIn('slow');
			socket.emit('api:categories.getRecentReplies', templates.get('category_id'), renderRecentReplies);

			addActiveUser(data);

			$('#topics-container span.timeago').timeago();
		});
	}

	function addActiveUser(data) {
		var activeUser = $('.category-sidebar .active-users').find('a[data-uid="' + data.uid + '"]');
		if(!activeUser.length) {
			var newUser = templates.prepare(templates['category'].blocks['active_users']).parse({
				active_users: [{
					uid: data.uid,
					username: data.username,
					userslug: data.userslug,
					picture: data.teaser_userpicture
				}]
			});
			$(newUser).appendTo($('.category-sidebar .active-users'));
		}
	}

	Category.onTopicsLoaded = function(topics) {
		var html = templates.prepare(templates['category'].blocks['topics']).parse({
			topics: topics
		});

		translator.translate(html, function(translatedHTML) {
			var container = $('#topics-container');

			jQuery('#topics-container, .category-sidebar').removeClass('hidden');
			jQuery('#category-no-topics').remove();

			html = $(translatedHTML);
			container.append(html);

			$('#topics-container span.timeago').timeago();
			app.makeNumbersHumanReadable(html.find('.human-readable-number'));
		});
	}

	Category.loadMoreTopics = function(cid) {
		if (loadingMoreTopics) {
			return;
		}

		loadingMoreTopics = true;
		socket.emit('api:categories.loadMore', {
			cid: cid,
			after: $('#topics-container').children('.category-item').length
		}, function (data) {
			if (data.topics.length) {
				Category.onTopicsLoaded(data.topics);
			}
			loadingMoreTopics = false;
		});
	}

	function renderRecentReplies(posts) {
		if (!posts || posts.length === 0) {
			return;
		}

		var recentReplies = $('#category_recent_replies');
		var reply;
		for (var i = 0, numPosts = posts.length; i < numPosts; ++i) {

			reply = $('<li data-pid="'+ posts[i].pid +'">' +
						'<a href="' + RELATIVE_PATH + '/user/' + posts[i].userslug + '"><img title="' + posts[i].username + '" class="img-rounded user-img" src="' + posts[i].picture + '"/></a>' +
						'<a href="' + RELATIVE_PATH + '/topic/' + posts[i].topicSlug + '#' + posts[i].pid + '">' +
							'<strong><span>'+ posts[i].username + '</span></strong>' +
							'<p>' +	posts[i].content + '</p>' +
						'</a>' +
						'<span class="timeago pull-right" title="' + posts[i].relativeTime + '"></span>' +
					   '</li>');

			recentReplies.append(reply);
		}

		$('#category_recent_replies span.timeago').timeago();
		app.createUserTooltips();
	};

	return Category;
});