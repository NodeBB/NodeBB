(function() {
	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		isFollowing = templates.get('isFollowing');

	$(document).ready(function() {

		var rep = $('#reputation');
		rep.html(app.addCommas(rep.html()));
		
		var postcount = $('#postcount');
		postcount.html(app.addCommas(postcount.html()));
		
		var editLink = $('#editLink');
		var followBtn = $('#follow-btn');
			
		if( yourid !== theirid) {
			editLink.hide();
			if(isFollowing)
				followBtn.hide();
			else
				followBtn.show();
		}
		else {
			followBtn.hide();        
		}
		
		followBtn.on('click', function() {
			$.post('/users/follow', {uid: theirid},
				function(data) {
					followBtn.remove();
					$('#user-action-alert').html('You are now following'+ $('.account-username').text() +'!').show();
				}
			);
			return false;
		});

	});

}());