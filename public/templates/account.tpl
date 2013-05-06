<h1>Account Settings</h1>
<div class="well">
    <div class="alert" id="message" style="display:none">
        <button type="button" class="close" data-dismiss="message">&times;</button>
        <strong></strong>
        <p></p>
    </div>

	<!-- BEGIN user -->
		
	<img src="{user.picture}" />
	<br/>
	<span>{user.username}</span>
	<br/>		
    <label for="email">Email Address</label><input type="text" placeholder="Enter Email Address" id="email" /><br />
    <button class="btn btn-primary" id="reset" type="submit">Reset Password</button>
	<br/>	
	<span>Member for </span>
	<span id="membersince">{user.joindate}</span>
	<br/>
	
	<span>Reputation </span>
	<span id="membersince">{user.reputation}</span>
	<br/>


	<!-- END user -->



</div>
<script type="text/javascript">
(function() {
    // ...
}());
</script>