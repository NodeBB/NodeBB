'use strict';

/* globals define, app, socket, ajaxify, templates, translator */

define(['forum/accountheader'], function(header) {
	var AccountPosts = {},
		loadingMore = false;

	AccountPosts.init = function() {
		header.init();

		$('.user-favourite-posts img').addClass('img-responsive');

		app.enableInfiniteLoading(function() {
			if(!loadingMore) {
				loadMore();
			}
		});
	};

	function loadMore() {
		loadingMore = true;
		socket.emit('posts.loadMoreUserPosts', {
			uid: $('.account-username-box').attr('data-uid'),
			after: $('.user-favourite-posts').attr('data-nextstart')
		}, function(err, data) {
			if(err) {
				return app.alertError(err.message);
			}

			if (data.posts && data.posts.length) {
				onTopicsLoaded(data.posts);
				$('.user-favourite-posts').attr('data-nextstart', data.nextStart);
			}

			loadingMore = false;
		});
	}

	function onTopicsLoaded(posts) {
		ajaxify.loadTemplate('accountposts', function(accountposts) {
			var html = templates.parse(templates.getBlock(accountposts, 'posts'), {posts: posts});

			translator.translate(html, function(translatedHTML) {
				$('#category-no-topics').remove();

				html = $(translatedHTML);
				html.find('img').addClass('img-responsive');
				$('.user-favourite-posts').append(html);
				$('span.timeago').timeago();
				app.createUserTooltips();
				app.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	}

	return AccountPosts;
});