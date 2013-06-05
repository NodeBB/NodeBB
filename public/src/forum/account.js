(function() {
	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
        isFriend = templates.get('isFriend');

    $(document).ready(function() {

        var rep = $('#reputation');
        rep.html(app.addCommas(rep.html()));
        
        var postcount = $('#postcount');
        postcount.html(app.addCommas(postcount.html()));
        
        var editLink = $('#editLink');
		var addFriendBtn = $('#add-friend-btn');
		
        
        if( yourid !== theirid) {
            editLink.hide();
            if(isFriend)
           		addFriendBtn.hide();
           	else
           		addFriendBtn.show();
        }
    	else {
    		addFriendBtn.hide();        
    	}
        
        addFriendBtn.on('click', function() {
        	$.post('/users/addfriend', {uid: theirid},
            	function(data) {
            		addFriendBtn.remove();
            		$('#user-action-alert').html('Friend Added!').show();
				}                
			);
        	return false;
        });

    });

}());