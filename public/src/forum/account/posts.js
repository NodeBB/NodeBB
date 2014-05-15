'use strict';

/* globals define, app, socket, ajaxify, templates, translator, utils */

define(['forum/account/header'], function(header) {
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
				onPostsLoaded(data.posts);
				$('.user-favourite-posts').attr('data-nextstart', data.nextStart);
			}

			loadingMore = false;
		});
	}

	function onPostsLoaded(posts) {
		ajaxify.loadTemplate('account/posts', function(accountposts) {
			var html = templates.parse(templates.getBlock(accountposts, 'posts'), {posts: posts});

			translator.translate(html, function(translatedHTML) {

				html = $(translatedHTML);
				html.find('img').addClass('img-responsive');
				$('.user-favourite-posts').append(html);
				html.find('span.timeago').timeago();
				app.createUserTooltips();
				utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			});
		});
	}

	return AccountPosts;
});
