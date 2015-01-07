'use strict';

/* globals app, define, utils, socket*/

define('forum/search', ['search'], function(searchModule) {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#results').attr('data-search-query');

		$('#advanced-search #search-input').val(searchQuery);
		var params = utils.params();
		var select = $('#advanced-search select');
		if (params && params.in) {
			select.val(params.in);
		}

		if (params && params.by) {
			$('.by-container #posted-by-input').val(params.by);
		}

		select.on('change', function() {
			$('.by-container').toggleClass('hide', select.val() !== 'posts');
		});

		highlightMatches(searchQuery);

		$('#advanced-search').off('submit').on('submit', function(e) {
			e.preventDefault();
			var input = $(this).find('#search-input');
			var searchIn = $(this).find('select');
			var postedBy = $(this).find('#posted-by-input');

			searchModule.query({
				term: input.val(),
				in: searchIn.val(),
				by: postedBy.val()
			}, function() {
				input.val('');
			});
		});

		enableAutoComplete();
	};

	function highlightMatches(searchQuery) {
		var searchTerms = searchQuery.split(' ');
		var regexes = [];
		for (var i=0; i<searchTerms.length; ++i) {
			var regex = new RegExp(searchTerms[i], 'gi');
			regexes.push({regex: regex, term: searchTerms[i]});
		}

		$('.search-result-text').each(function() {
			var result = $(this);
			var text = result.html();
			for(var i=0; i<regexes.length; ++i) {
				text = text.replace(regexes[i].regex, '<strong>' + regexes[i].term + '</strong>');
			}
			result.html(text).find('img').addClass('img-responsive');
		});
	}


	function enableAutoComplete() {
		var input = $('.by-container #posted-by-input');
		input.autocomplete({
			delay: 100,
			source: function(request, response) {
				socket.emit('user.search', {query: request.term}, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.users) {
						var names = result.users.map(function(user) {
							return user && user.username;
						});
						response(names);
					}
					$('.ui-autocomplete a').attr('data-ajaxify', 'false');
				});
			}
		});
	}

	return Search;
});
