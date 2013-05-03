<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a> <span class="divider">/</span></li>
		<li class="active">{topic_name}</li>
	</ul>
</div>

<ul id="post-container" class="post-container container">
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
jQuery('document').ready(function() {
	// join room for this thread - DRY failure, see ajaxify and app.js
	socket.emit('event:enter_room', 'topic_' + '{topic_id}');
	current_room = 'topic_' + '{topic_id}';
});

jQuery('.post_reply').click(function() {
	app.open_post_window('reply', "{topic_id}", "{topic_name}");
});

jQuery('.quote').click(function() {
	app.open_post_window('quote', "{topic_id}", "{topic_name}");

	// this needs to be looked at, obviously. only single line quotes work well I think maybe replace all \r\n with > ?
	document.getElementById('post_content').innerHTML = '> ' + document.getElementById('content_' + this.id.replace('quote_', '')).innerHTML;
});



ajaxify.register_events(['event:rep_up', 'event:rep_down']);

socket.on('event:rep_up', function(data) {
	adjust_rep(1, data.pid, data.uid);
});

socket.on('event:rep_down', function(data) {
	adjust_rep(-1, data.pid, data.uid);
});

socket.on('event:new_post', function(data) {
	var html = templates.prepare(templates['topic'].blocks['posts']).parse(data);

	jQuery('<div></div>').appendTo("#post-container").hide().append(html).fadeIn('slow');	
});
/*
jQuery('document').ready(function() {
	setTimeout(function() {
		//console.log(JSON.stringify(templates['topic'].blocks));
		var html = templates.prepare(templates['topic'].blocks['posts']).parse({
				'posts' : [
					{
						'username' : 'derp'
					}
				]
			});

		jQuery('<div></div>').appendTo("#post-container").hide().append(html).fadeIn('slow');
		
	}, 1500);
});
*/
function adjust_rep(value, pid, uid) {
	var post_rep = document.getElementById('post_rep_' + pid),
		user_rep = document.getElementById('user_rep_' + uid);

	var ptotal = parseInt(post_rep.innerHTML, 10),
		utotal = parseInt(user_rep.innerHTML, 10);

	ptotal += value;
	utotal += value;

	post_rep.innerHTML = ptotal;
	user_rep.innerHTML = utotal;
}


jQuery('.favourite').click(function() {
	var ids = this.id.replace('favs_', '').split('_'),
		pid = ids[0],
		uid = ids[1];

	
	if (this.children[1].className == 'icon-star-empty') {
		this.children[1].className = 'icon-star';
		socket.emit('api:posts.favourite', {pid: pid, room_id: current_room});
	}
	else {
		this.children[1].className = 'icon-star-empty';
		socket.emit('api:posts.unfavourite', {pid: pid, room_id: current_room});
	}
})
</script>