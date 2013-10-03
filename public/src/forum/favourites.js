define(['forum/accountheader'], function(header) {
	var AccountHeader = {};

	AccountHeader.init = function() {
		header.init();

		$('.user-favourite-posts .topic-row').on('click', function() {
			ajaxify.go($(this).attr('topic-url'));
		});
	};

	return AccountHeader;
});