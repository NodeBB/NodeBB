define('forum/search', function() {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#post-results').attr('data-search-query');

		$('.search-result-text').each(function() {
			var result = $(this);
			var text = result.html();
			var regex = new RegExp(searchQuery, 'gi');
			text = text.replace(regex, '<strong>' + searchQuery + '</strong>');
			result.html(text).find('img').addClass('img-responsive');
		});

		$('#search-form input').val(searchQuery);

		$('#mobile-search-form').off('submit').on('submit', function() {
			var input = $(this).find('input');
			ajaxify.go('search/' + input.val(), null, 'search');
			input.val('');
			return false;
		});
	};

	return Search;
});
