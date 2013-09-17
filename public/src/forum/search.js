(function() {

	$(document).ready(function() {
		var searchQuery = $('#topics-container').attr('data-search-query');

		$('.search-result-text').each(function() {
			var text = $(this).html();
			var regex = new RegExp(searchQuery, 'gi');
			text = text.replace(regex, '<span class="label label-success">' + searchQuery + '</span>');
			$(this).html(text);
		});


		$('#search-form input').val(searchQuery);
	});

})();