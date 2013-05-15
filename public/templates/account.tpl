
<div class="well">
   


  <div class="account-username-box">
		<span class="account-username">
			<a href="/users/{username}">{username}</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="friendsLink" class="pull-right"><a href="/users/{username}/friends">friends</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
		</div>
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
		<a id="add-friend-btn" href="#" class="btn">Follow</a>
	</div>
	<br/>
	<div id="user-action-alert" class="alert alert-success hide"></div>
</div>

<script type="text/javascript">

var yourid = '{yourid}';
var theirid = '{theirid}';

(function() {

	var isFriend = {isFriend};

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
</script>