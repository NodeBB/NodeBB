<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a> <span class="divider">/</span></li>
		<li class="active">{TOPIC_NAME}</li>
	</ul>
</div>

<ul class="post-container container">
<!-- BEGIN posts -->
<li class="row">
	<div class="span1 profile-image-block">
		
			<img src="https://en.gravatar.com/userimage/18452752/f59e713c717466d2f5ad2a6970769f32.png" align="left" />
			
	</div>
	<div class="span11">
		<div class="post-block">
			

			<p>{posts.content}</p>
			<!--<p>Posted {posts.relativeTime} by user {posts.uid}.</p>-->
			<div class="profile-block">
				posted by <strong>psychobunny</strong> {posts.relativeTime}
				<span class="post-buttons">
					<div class="quote"><i class="icon-quote-left"></i></div>
					<div class="favourite"><i class="icon-star-empty"></i></div>
					<div class="post_reply">Reply <i class="icon-reply"></i></div>
				</span>
			</div>
		</div>
	</div>
</li>
<!-- END posts -->
</ul>
<hr />
<button id="post_reply" class="btn btn-primary btn-large post_reply">Reply</button>


<script type="text/javascript">
jQuery('.post_reply').click(function() {
	app.open_post_window('reply', "{TOPIC_ID}", "{TOPIC_NAME}");
});

jQuery('.quote').click(function() {
	app.open_post_window('quote', "{TOPIC_ID}", "{TOPIC_NAME}");
});

jQuery('.favourite').click(function() {
	if (this.children[0].className == 'icon-star-empty') this.children[0].className = 'icon-star';
	else this.children[0].className = 'icon-star-empty';
})
</script>