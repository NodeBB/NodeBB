
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
		
	<div class="account-picture-block">
		<img src="{picture}" class="user-profile-picture"/>
	</div>
	
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
	 
   
	<!-- END user -->
 


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
        if( yourid !== theirid)
            editLink.addClass('hidden');
        
    });
    

}());
</script>