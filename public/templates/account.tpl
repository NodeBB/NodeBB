<h1>Account Settings</h1>
<div class="well">
    <div class="alert" id="message" style="display:none">
        <button type="button" class="close" data-dismiss="message">&times;</button>
        <strong></strong>
        <p></p>
    </div>

	<!-- BEGIN user -->
	
	<span class="account-username">{user.username}</span>
	<br/>		
		
	<div class="account-bio-block">
		<img src="{user.picture}?s=128" />
	</div>
	
	<div class="account-bio-block">
		<span class="account-bio-label">Member for </span>
		<span>{user.joindate}</span>
		<br/>
		
		<span class="account-bio-label">Reputation </span>
		<span>{user.reputation}</span>
		<br/>		
		
		<span class="account-bio-label">Posts</span>
		<span>{user.postcount}</span>
	</div>
	
	<br/>
	
	

	<br/>	


    <label for="email">Email Address</label><input type="text" placeholder="Enter Email Address" id="email" /><br />
    <button class="btn btn-primary" id="reset" type="submit">Reset Password</button>


	<!-- END user -->



</div>
<script type="text/javascript">
(function() {
    // ...
}());
</script>