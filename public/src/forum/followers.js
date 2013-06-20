(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		followersCount = templates.get('followersCount');

	$(document).ready(function() {
		
		if(parseInt(followersCount, 10) === 0) {
			$('#no-followers-notice').show();
		}
		var editLink = $('#editLink');

		if(yourid !== theirid) {
			editLink.hide();
		}

		$('.reputation').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
		$('.postcount').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
	});
	

}());