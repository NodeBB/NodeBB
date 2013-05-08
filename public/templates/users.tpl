
<h1>Users</h1>
<div>
    <!-- BEGIN users -->

    <div class="users-box well">
	 	<a href="/users/{users.username}">
		    <img src="{users.picture}"/>
	    </a>
	    <br/>
		<a href="/users/{users.username}">{users.username}</a>
	    <br/>
		<div title="reputation">
			<span id='reputation'>{users.reputation}</span>
			<i class='icon-star'></i>
		</div>
		<div title="post count">
			<span id='postcount'>{users.postcount}</span>
			<i class='icon-pencil'></i>
		</div>

	</div>

	<!-- END users -->
</div>

<script>
(function() {
    
    function addCommas(text) {
        return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
    }
    
    $(document).ready(function() {
        var rep = $('#reputation');
        rep.html(addCommas(rep.html()));
        
        var postcount = $('#postcount');
        postcount.html(addCommas(postcount.html()));
        
    });
    

}());
</script>