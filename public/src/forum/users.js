(function() {
	
    $(document).ready(function() {
        
        $('.reputation').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
        $('.postcount').each(function(index, element) {
        	$(element).html(app.addCommas($(element).html()));
        });
        
    });

}());