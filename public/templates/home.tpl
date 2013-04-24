<button id="new_post" class="btn btn-primary btn-large">New Post</button>

<script type="text/javascript">
var new_post = document.getElementById('new_post');
new_post.onclick = function() {
	app.open_post_window();
}



/*app.alert({
	title: 'Welcome back',
	message: 'Some welcome message to test alerts!',
	type: 'info',
	timeout: 2000
});*/
</script>