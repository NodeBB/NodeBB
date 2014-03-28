define(['forum/accountheader'], function(header) {
	var Favourites = {},
		loadingMore = false;

	Favourites.init = function() {
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
		socket.emit('posts.loadMoreFavourites', {
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
		ajaxify.loadTemplate('favourites', function(favouritesTemplate) {
			var html = templates.parse(templates.getBlock(favouritesTemplate, 'posts'), {posts: posts});

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

	return Favourites;
});