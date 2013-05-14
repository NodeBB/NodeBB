
<div class="well">
    <div class="alert" id="message" style="display:none">
        <button type="button" class="close" data-dismiss="message">&times;</button>
        <strong></strong>
        <p></p>
    </div>


	<div class="account-username-box">
		<span class="account-username"><a href="/users/{username}">{username}</a></span>
		<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
	</div>
		

	<div class="row-fluid">
		<div class="span3" style="text-align: center; margin-bottom:20px;">
			<div class="account-picture-block">
				<img src="{picture}" class="user-profile-picture"/>
			</div>
		</div>
	
		<div class="span9">
			<div class="inline-block">
				<div class="account-bio-block">
					<span class="account-bio-label">email</span>
					<span>{email}</span>
					<br/>
					
					<span class="account-bio-label">full name</span>
			        <span>{fullname}</span>
			        <br/>
			        
			        <span class="account-bio-label">website</span>
			        <span><a href="{website}">{website}</a></span>
			        <br/>
					
					<span class="account-bio-label">location</span>
			        <span>{location}</span>
			        <br/>
			        
			        <span class="account-bio-label">age</span>
			        <span>{age}</span>
			        <br/>
					
					<span class="account-bio-label">member for</span>
					<span>{joindate}</span>
					<br/>

					<span class="account-bio-label">reputation</span>
					<span id='reputation'>{reputation}</span>
					<br/>		
					
					<span class="account-bio-label">posts</span>
					<span id='postcount'>{postcount}</span>
				</div>
			</div>
		</div>
	</div>
	<div id="user-actions" class="container">
		<a id="add-friend-btn" href="#" class="btn">Add Friend</a>
		<a id="send-message-btn" href="#" class="btn">Send Message</a>
	</div>
</div>

<script type="text/javascript">

var yourid = '{yourid}';
var theirid = '{theirid}';



(function() {
	
	

    function addCommas(text) {
        return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
    }
    
    $(document).ready(function() {

        var rep = $('#reputation');
        rep.html(addCommas(rep.html()));
        
        var postcount = $('#postcount');
        postcount.html(addCommas(postcount.html()));
        
        var editLink = $('#editLink');
		var addFriendBtn = $('#add-friend-btn');
		var sendMessageBtn = $('#send-message-btn');
        
        if( yourid !== theirid) {
            editLink.hide();
            addFriendBtn.show();
            sendMessageBtn.show();
    	}
    	else {
    		addFriendBtn.hide();
            sendMessageBtn.hide();	
    	}
        
        addFriendBtn.on('click', function() {
        	$.post('/users/addfriend', {uid: theirid},
            	function(data) {
            		
				}                
			);
        	return false;
        });

        sendMessageBtn.on('click', function() {
        	return false;
        });

    });
    

}());
</script>