define('forum/search', ['search'], function(searchModule) {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#results').attr('data-search-query');
		var regexes = [];
		var searchTerms = searchQuery.split(' ');

		$('#advanced-search input').val(searchQuery);
		var params = utils.params();
		if (params && params.in) {
			$('#advanced-search select').val(params.in);
		}


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


		$('#advanced-search').off('submit').on('submit', function(e) {
			e.preventDefault();
			var input = $(this).find('input');
			var searchIn = $(this).find('select');

			searchModule.query(input.val(), searchIn.val(), function() {
				input.val('');
			});
		});
	};

	return Search;
});
