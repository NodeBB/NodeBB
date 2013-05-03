<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a> <span class="divider">/</span></li>
		<li class="active">{topic_name}</li>
	</ul>
</div>

<ul class="post-container container">
<!-- BEGIN posts -->
<li class="row">
	<div class="span1 profile-image-block">
		<!--<i class="icon-spinner icon-spin icon-2x pull-left"></i>-->
		<img src="{posts.gravatar}" align="left" />
		<i class="icon-star"></i>2432
	</div>
	<div class="span11">
		<div class="post-block">
			<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
			<!--<p>Posted {posts.relativeTime} by user {posts.uid}.</p>-->
			<div class="profile-block">
				posted by <strong>{posts.userName}</strong> {posts.relativeTime}
				<span class="post-buttons">
					<div id="quote_{posts.pid}" class="quote"><i class="icon-quote-left"></i></div>
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
	app.open_post_window('reply', "{topic_id}", "{topic_name}");
});

jQuery('.quote').click(function() {
	app.open_post_window('quote', "{topic_id}", "{topic_name}");

	// this needs to be looked at, obviously. only single line quotes work well I think maybe replace all \r\n with > ?
	document.getElementById('post_content').innerHTML = '> ' + document.getElementById('content_' + this.id.replace('quote_', '')).innerHTML;
});

jQuery('.favourite').click(function() {
	if (this.children[0].className == 'icon-star-empty') this.children[0].className = 'icon-star';
	else this.children[0].className = 'icon-star-empty';
})
</script>