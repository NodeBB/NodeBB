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
		if(yourid === "0") {
			editLink.hide();
			followBtn.hide();
		}
		else if(yourid !== theirid) {
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
		
			followBtn.remove();
			socket.emit('api:user.follow', {uid: theirid});
			return false;
		});

		$('.user-recent-posts .topic-row').on('click', function() {
			ajaxify.go($(this).attr('topic-url'));
		});
		
		var onlineStatus = $('.account-online-status');
		
		socket.on('api:user.isOnline', function(online) {
			if(online) {
				onlineStatus.find('span span').text('online');
				onlineStatus.find('i').attr('class', 'icon-circle');
			} else {
				onlineStatus.find('span span').text('offline');
				onlineStatus.find('i').attr('class', 'icon-circle-blank');
			}
		});
		
		socket.emit('api:user.isOnline', theirid);

	});

}());