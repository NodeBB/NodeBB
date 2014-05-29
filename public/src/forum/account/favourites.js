'use strict';

/* globals define, app, utils */

define('forum/account/favourites', ['forum/account/header', 'forum/infinitescroll'], function(header, infinitescroll) {
	var Favourites = {};

	Favourites.init = function() {
		header.init();

		$('.user-favourite-posts img').addClass('img-responsive');

		infinitescroll.init(loadMore);
	};

	function loadMore(direction) {
		if (direction < 0) {
			return;
		}

		infinitescroll.loadMore('posts.loadMoreFavourites', {
			after: $('.user-favourite-posts').attr('data-nextstart')
		}, function(data) {
			if (data.posts && data.posts.length) {
				onPostsLoaded(data.posts);
				$('.user-favourite-posts').attr('data-nextstart', data.nextStart);
			}
		});
	}

	function onPostsLoaded(posts) {
		infinitescroll.parseAndTranslate('account/favourites', 'posts', {posts: posts}, function(html) {
			$('.user-favourite-posts').append(html);
			html.find('img').addClass('img-responsive');
			html.find('span.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
		});
	}

	return Favourites;
});
