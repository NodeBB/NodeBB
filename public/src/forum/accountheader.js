(function() {
	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid');

	$(document).ready(function() {
		
		var editLink = $('#editLink');
		var settingsLink = $('#settingsLink');
		
		if(yourid === "0") {
			editLink.hide();
			settingsLink.hide();
		}
		else if(yourid !== theirid) {
			editLink.hide();
			settingsLink.hide();
		}
	});

}());