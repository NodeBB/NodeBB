(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		friendCount = templates.get('friendCount');

    $(document).ready(function() {
    	
    	if(parseInt(friendCount, 10) === 0) {
    		$('#no-friend-notice').show();
    	}
    	var editLink = $('#editLink');

		if(yourid !== theirid) {
			editLink.hide();
			$('.remove-friend-btn').hide();
		}
		else {
			$('.remove-friend-btn').on('click',function(){

				var removeBtn = $(this);
				var friendid = $(this).attr('friendid');
				
				$.post('/users/removefriend', {uid: friendid},
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