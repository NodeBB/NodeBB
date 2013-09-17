(function() {
	$(document).ready(function() {
		$('.user-favourite-posts .topic-row').on('click', function() {
			ajaxify.go($(this).attr('topic-url'));
		});
	});
}());