define(function() {
	var	Search = {};

	Search.init = function() {
		var searchQuery = $('#topic-results').attr('data-search-query');

		$('.search-result-text').each(function() {
			var text = $(this).html();
			var regex = new RegExp(searchQuery, 'gi');
			text = text.replace(regex, '<span class="label label-success">' + searchQuery + '</span>');
			$(this).html(text);
		});

		$('#search-form input').val(searchQuery);

		$('#mobile-search-form').off('submit').on('submit', function() {
			var input = $(this).find('input');
			ajaxify.go("search/" + input.val(), null, "search");
			input.val('');
			return false;
		});
	};

	return Search;
});