(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		followingCount = templates.get('followingCount');

    $(document).ready(function() {
    	
    	if(parseInt(followingCount, 10) === 0) {
    		$('#no-following-notice').show();
    	}
    	var editLink = $('#editLink');

		if(yourid !== theirid) {
			editLink.hide();
			$('.unfollow-btn').hide();
		}
		else {
			$('.unfollow-btn').on('click',function(){

				var removeBtn = $(this);
				var followingUid = $(this).attr('followingUid');
				
				$.post('/users/unfollow', {uid: followingUid, _csrf:$('#csrf_token').val()},
	            	function(data) {
	            		removeBtn.parent().remove();
					}                
				);
				return false;
			});
		}

        $('.reputation').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
        $('.postcount').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
    });
    

}());