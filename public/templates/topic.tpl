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
		<i class="icon-star"></i><span id="user_rep_{posts.uid}">{posts.user_rep}</span>
	</div>
	<div class="span11">
		<div class="post-block">
			<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
			<!--<p>Posted {posts.relativeTime} by user {posts.uid}.</p>-->
			<div class="profile-block">
				posted by <strong>{posts.username}</strong> {posts.relativeTime}
				<span class="post-buttons">
					<div id="quote_{posts.pid}" class="quote"><i class="icon-quote-left"></i></div>
					<div id="favs_{posts.pid}_{posts.uid}" class="favourite"><span id="post_rep_{posts.pid}">{posts.post_rep}</span><i class="{posts.fav_star_class}"></i></div>
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
	var ids = this.id.replace('favs_', '').split('_'),
		pid = ids[0],
		uid = ids[1],
		post_rep = document.getElementById('post_rep_' + pid),
		user_rep = document.getElementById('user_rep_' + uid);

	var ptotal = parseInt(post_rep.innerHTML, 10),
		utotal = parseInt(user_rep.innerHTML, 10);

	if (this.children[1].className == 'icon-star-empty') {
		this.children[1].className = 'icon-star';
		ptotal++;
		utotal++;

		post_rep.innerHTML = ptotal;
		user_rep.innerHTML = utotal;
		socket.emit('api:posts.favourite', {pid: pid});
	}
	else {
		this.children[1].className = 'icon-star-empty';
		ptotal--;
		utotal--;


		post_rep.innerHTML = ptotal;
		user_rep.innerHTML = utotal;
		socket.emit('api:posts.unfavourite', {pid: pid});
	}
})
</script>