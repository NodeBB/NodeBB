'use strict';

/* globals app, define, utils, socket*/

define('forum/search', ['search'], function(searchModule) {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#results').attr('data-search-query');

		$('#advanced-search #search-input').val(searchQuery);

		var searchIn = $('#advanced-search #search-in');

		fillOutForm();

		searchIn.on('change', function() {
			updateFormItemVisiblity(searchIn.val());
		});

		highlightMatches(searchQuery);

		$('#advanced-search').off('submit').on('submit', function(e) {
			e.preventDefault();
			
			var input = $(this).find('#search-input');

			var searchData = getSearchData();
			searchData.term = input.val();

			searchModule.query(searchData, function() {
				input.val('');
			});
		});

		handleSavePreferences();

		enableAutoComplete();
	};

	function getSearchData() {
		var form = $('#advanced-search');
		var searchData = {
			in: form.find('#search-in').val(),
			by: form.find('#posted-by-user').val(),
			categories: form.find('#posted-in-categories').val(),
			searchChildren: form.find('#search-children').is(':checked'),
			replies: form.find('#reply-count').val(),
			repliesFilter: form.find('#reply-count-filter').val(),
			timeFilter: form.find('#post-time-filter').val(),
			timeRange: form.find('#post-time-range').val(),
			sortBy: form.find('#post-sort-by').val(),
			sortDirection: form.find('#post-sort-direction').val()
		};
		return searchData;
	}

	function updateFormItemVisiblity(searchIn) {
		var hide = searchIn.indexOf('posts') === -1 && searchIn.indexOf('titles') === -1;
		$('.post-search-item').toggleClass('hide', hide);
	}

	function fillOutForm() {
		var params = utils.params();
		var searchData = getSearchPreferences();
		params = utils.merge(searchData, params);
		
		if (params) {
			if (params.in) {
				$('#search-in').val(params.in);
				updateFormItemVisiblity(params.in);
			}

			if (params.by) {
				$('#posted-by-user').val(params.by);
			}

			if ((params['categories[]'] || params.categories)) {
				$('#posted-in-categories').val(params['categories[]'] || params.categories);
			}

			if (params.searchChildren) {
				$('#search-children').prop('checked', true);
			}

			if (params.replies) {
				$('#reply-count').val(params.replies);
				$('#reply-count-filter').val(params.repliesFilter);
			}

			if (params.timeRange) {
				$('#post-time-range').val(params.timeRange);
				$('#post-time-filter').val(params.timeFilter);
			}

			if (params.sortBy) {
				$('#post-sort-by').val(params.sortBy);
				$('#post-sort-direction').val(params.sortDirection);
			}
		}
	}

	function highlightMatches(searchQuery) {
		if (!searchQuery) {
			return;
		}
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

	function handleSavePreferences() {
		$('#save-preferences').on('click', function() {			
			localStorage.setItem('search-preferences', JSON.stringify(getSearchData()));
			app.alertSuccess('[[search:search-preferences-saved]]');
			return false;
		});

		$('#clear-preferences').on('click', function() {
			localStorage.removeItem('search-preferences');
			app.alertSuccess('[[search:search-preferences-cleared]]');
			return false;
		});
	}

	function getSearchPreferences() {
		try {
			return JSON.parse(localStorage.getItem('search-preferences'));
		} catch(e) {
			return {};
		}
	}

	function enableAutoComplete() {
		var input = $('#posted-by-user');
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
