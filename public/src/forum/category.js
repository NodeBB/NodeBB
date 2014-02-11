define(['composer', 'forum/pagination'], function(composer, pagination) {
	var Category = {},
		loadingMoreTopics = false;

	Category.init = function() {
		var	cid = templates.get('category_id'),
			categoryName = templates.get('category_name'),
			categoryUrl = encodeURIComponent(window.location.href),
			twitterUrl = "https://twitter.com/intent/tweet?url=" + categoryUrl + "&text=" + encodeURIComponent(categoryName),
			facebookUrl = "https://www.facebook.com/sharer/sharer.php?u=" + categoryUrl,
			googleUrl = "https://plus.google.com/share?url=" + categoryUrl;

		app.enterRoom('category_' + cid);

		$('#twitter-intent').on('click', function () {
			window.open(twitterUrl, '_blank', 'width=550,height=420,scrollbars=no,status=no');
			return false;
		});

		$('#facebook-share').on('click', function () {
			window.open(facebookUrl, '_blank', 'width=626,height=436,scrollbars=no,status=no');
			return false;
		});

		$('#google-share').on('click', function () {
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

		socket.emit('categories.getRecentReplies', cid, renderRecentReplies);

		enableInfiniteLoading();
	};

	function enableInfiniteLoading() {
		if(!config.usePagination) {
			app.enableInfiniteLoading(function() {
				if(!loadingMoreTopics) {
					Category.loadMoreTopics(templates.get('category_id'));
				}
			});
		} else {
			pagination.init(templates.get('currentPage'), templates.get('pageCount'));
		}
	}

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
			socket.emit('categories.getRecentReplies', templates.get('category_id'), renderRecentReplies);

			addActiveUser(data);

			socket.emit('categories.getPageCount', templates.get('category_id'), function(err, newPageCount) {
				pagination.recreatePaginationLinks(newPageCount);
			});

			$('#topics-container span.timeago').timeago();
			app.createUserTooltips();
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

			if(config.usePagination) {
				container.empty().append(html);
			} else {
				container.append(html);
			}

			$('#topics-container span.timeago').timeago();
			app.createUserTooltips();
			app.makeNumbersHumanReadable(html.find('.human-readable-number'));
		});
	}

	Category.loadMoreTopics = function(cid) {
		if (loadingMoreTopics || !$('#topics-container').length) {
			return;
		}

		loadingMoreTopics = true;
		socket.emit('categories.loadMore', {
			cid: cid,
			after: $('#topics-container').attr('data-nextstart')
		}, function (err, data) {
			if(err) {
				return app.alertError(err.message);
			}

			if (data && data.topics.length) {
				Category.onTopicsLoaded(data.topics);
				$('#topics-container').attr('data-nextstart', data.nextStart);
			}
			loadingMoreTopics = false;
		});
	}

	function renderRecentReplies(err, posts) {
		if (err || !posts || posts.length === 0) {
			return;
		}

		var recentReplies = $('#category_recent_replies');

		templates.preload_template('recentreplies', function() {

			templates['recentreplies'].parse({posts:[]});

			var html = templates.prepare(templates['recentreplies'].blocks['posts']).parse({
				posts: posts
			});

			translator.translate(html, function(translatedHTML) {
				translatedHTML = $(translatedHTML);
				translatedHTML.find('img').addClass('img-responsive');

				recentReplies.html(translatedHTML);

				$('#category_recent_replies span.timeago').timeago();
				app.createUserTooltips();
			});
		});
	};

	return Category;
});