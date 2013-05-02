<button id="new_post" class="btn btn-primary btn-large">New Post</button>
<ul class="topic-container">
<!-- BEGIN topics -->
<a href="topic/{topics.slug}"><li class="topic-row">
	<h4>{topics.title}</h4>
	<p>Posted {topics.relativeTime} by <span class="username">{topics.uid}</span>. {topics.post_count} posts.</p>
</li></a>
<!-- END topics -->
</ul>
<script type="text/javascript">
var new_post = document.getElementById('new_post');
new_post.onclick = function() {
	app.open_post_window();
}

jQuery('document').ready(function() {
	jQuery('.username').each(function() {
		var userId = this.innerHTML;

		(function(span){
			socket.on('api:user.getNameByUid', function(username) {
				span.innerHTML = username;	
			});
		})(this);
		
		socket.emit('api:user.getNameByUid', { fields: [ 'username' ], 'uid': userId });

	})
	
	
	
	
	
});


/*app.alert({
	title: 'Welcome back',
	message: 'Some welcome message to test alerts!',
	type: 'info',
	timeout: 2000
});*/
</script>