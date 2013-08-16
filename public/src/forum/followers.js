(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		followersCount = templates.get('followersCount');

	$(document).ready(function() {
		
		if(parseInt(followersCount, 10) === 0) {
			$('#no-followers-notice').show();
		}
		
		app.addCommasToNumbers();
		
	});
	

}());