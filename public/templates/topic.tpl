<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a> <span class="divider">/</span></li>
		<li class="active">{topic_name}</li>
	</ul>
</div>

<ul id="post-container" class="post-container container">
<!-- BEGIN posts -->
<li class="row">
	<div class="span1 profile-image-block visible-desktop">
		<!--<i class="icon-spinner icon-spin icon-2x pull-left"></i>-->
		<img src="{posts.gravatar}80" align="left" />
		<i class="icon-star"></i><span class="user_rep_{posts.uid}">{posts.user_rep}</span>
	</div>
	<div class="span11">
		<div class="post-block">
			<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
			<div class="profile-block">
				<img class="hidden-desktop" src="{posts.gravatar}10" align="left" /> posted by <strong>{posts.username}</strong> {posts.relativeTime}
				<span class="post-buttons">
					<div id="ids_{posts.pid}_{posts.uid}" class="edit {posts.display_moderator_tools} hidden-phone"><i class="icon-pencil"></i></div>
					<div id="ids_{posts.pid}_{posts.uid}" class="delete {posts.display_moderator_tools} hidden-phone"><i class="icon-trash"></i></div>
					<div id="quote_{posts.pid}_{posts.uid}" class="quote hidden-phone"><i class="icon-quote-left"></i></div>
					<div id="favs_{posts.pid}_{posts.uid}" class="favourite hidden-phone"><span class="post_rep_{posts.pid}">{posts.post_rep}</span><i class="{posts.fav_star_class}"></i></div>
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
	set_up_posts();
});


ajaxify.register_events(['event:rep_up', 'event:rep_down']);

socket.on('event:rep_up', function(data) {
	adjust_rep(1, data.pid, data.uid);
});

socket.on('event:rep_down', function(data) {
	adjust_rep(-1, data.pid, data.uid);
});

socket.on('event:new_post', function(data) {
	var html = templates.prepare(templates['topic'].blocks['posts']).parse(data),
		uniqueid = new Date().getTime();

	jQuery('<div id="' + uniqueid + '"></div>').appendTo("#post-container").hide().append(html).fadeIn('slow');	
	set_up_posts(uniqueid);
});

function adjust_rep(value, pid, uid) {
	var post_rep = jQuery('.post_rep_' + pid),
		user_rep = jQuery('.user_rep_' + uid);

	var ptotal = parseInt(post_rep.html(), 10),
		utotal = parseInt(user_rep.html(), 10);

	ptotal += value;
	utotal += value;

	post_rep.html(ptotal);
	user_rep.html(utotal);
}


function set_up_posts(div) {
	if (div == null) div = '';
	else div = '#' + div;

	jQuery(div + ' .post_reply').click(function() {
		app.open_post_window('reply', "{topic_id}", "{topic_name}");
	});

	jQuery(div + ' .quote').click(function() {
		app.open_post_window('quote', "{topic_id}", "{topic_name}");

		// this needs to be looked at, obviously. only single line quotes work well I think maybe replace all \r\n with > ?
		document.getElementById('post_content').innerHTML = '> ' + document.getElementById('content_' + this.id.replace('quote_', '')).innerHTML;
	});

	jQuery(div + ' .edit, ' + div + ' .delete').each(function() {
		var ids = this.id.replace('ids_', '').split('_'),
			pid = ids[0],
			uid = ids[1];

	});

	jQuery(div + ' .favourite').click(function() {
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
	});
}
</script>