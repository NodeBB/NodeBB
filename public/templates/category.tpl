<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a><span class="divider">/</span></li>
		<li class="active">{category_name}</li>
		<div id="category_active_users"></div>
	</ul>
</div>
<div class="alert alert-warning hide" id="category-no-topics">
	<strong>There are no topics in this category.</strong><br />
	Why don't you try posting one?
</div>
<div class="category row">

	<div class="{topic_row_size}">
		<ul id="topics-container">
		<!-- BEGIN topics -->
		<a href="../../topic/{topics.slug}"><li class="category-item {topics.deleted-class}">
			<div class="row-fluid">
				<!-- <div class="span1 thread-rating hidden-phone hidden-tablet">
					<span>
						<i class="icon-star icon-3x"></i><br />
						38
					</span>
				</div> -->
				<div class="span12 topic-row img-polaroid">
					<div class="latest-post visible-desktop">
						<div class="pull-right">
							<img style="width: 48px; height: 48px; /*temporary*/" src="/graph/users/{topics.teaser_username}/picture" />
							<p><strong>{topics.teaser_username}</strong>: {topics.teaser_text}</p>
							<span>posted {topics.teaser_timestamp} ago</span>
						</div>
					</div>
					<div>
						<h3><span class="topic-title"><span class="badge {topics.badgeclass}">{topics.post_count}</span>{topics.title}</span></h3>
						<small>
							<strong><i class="{topics.pin-icon}"></i><i class="{topics.lock-icon}"></i></strong>
							Posted {topics.relativeTime} ago by 
							<strong>{topics.username}</strong>.
						</small> 
					</div>
				</div>
			</div>
		</li></a>
		<!-- END topics -->
		</ul>
		<hr />
		<button id="new_post" class="btn btn-primary btn-large {show_category_features}">New Topic</button>
	</div>
	<div class="span3 {show_category_features}">
		<div class="sidebar-block img-polaroid">
			<div class="block-header">
				Recent Replies
			</div>
			<div class="block-content recent-replies" id="category_recent_replies">
				
			</div>
		</div>
		<div class="sidebar-block img-polaroid">
			<div class="block-header">
				Active Participants
			</div>
			<div class="block-content">
				<!-- BEGIN active_users -->
				<a href="/users/{active_users.username}"><img title="{active_users.username}" style="width: 48px; height: 48px; /*temporary*/" src="/graph/users/{active_users.username}/picture" class="img-polaroid" /></a>
				<!-- END active_users -->
			</div>
		</div>
		<div class="sidebar-block img-polaroid {moderator_block_class}">
			<div class="block-header">
				Moderators
			</div>
			<div class="block-content">
				<!-- BEGIN moderators -->
				<a href="/users/{moderators.username}"><img title="{moderators.username}" style="width: 48px; height: 48px; /*temporary*/" src="/graph/users/{moderators.username}/picture" class="img-polaroid" /></a>
				<!-- END moderators -->
			</div>
		</div>
	</div>
</div>




<input type="hidden" template-variable="category_id" value="{category_id}" />

<script type="text/javascript">
(function() {
	var cid = templates.get('category_id'),
		room = 'category_' + cid;
		
	app.enter_room(room);

	var new_post = document.getElementById('new_post');
	new_post.onclick = function() {
		app.open_post_window('topic', {category_id});
	}

	ajaxify.register_events([
		'event:new_topic'
	]);

	if (jQuery('.category-item').length == 0) {
		jQuery('.category.row').hide();
		jQuery('#category-no-topics').show();
	}

	socket.on('event:new_topic', function(data) {
		var html = templates.prepare(templates['category'].blocks['topics']).parse({ topics: [data] }),
			topic = document.createElement('div'),
			container = document.getElementById('topics-container'),
			topics = document.querySelectorAll('#topics-container a'),
			numTopics = topics.length,
			x;

		jQuery('.category.row').show();
		jQuery('#category-no-topics').hide();

		topic.innerHTML = html;
		if (numTopics > 0) {
			for(x=0;x<numTopics;x++) {
				if (topics[x].querySelector('.icon-pushpin')) continue;
				container.insertBefore(topic.querySelector('a'), topics[x]);
				$(topic).hide().fadeIn('slow');
				break;
			}
		} else {
			container.insertBefore(topic.querySelector('a'), null);
			$(topic).hide().fadeIn('slow');
		}

		// jQuery('<div></div>').appendTo("#topics-container").hide().append(html).fadeIn('slow');	
		// set_up_posts(uniqueid);
	});



	socket.emit('api:categories.getRecentReplies', cid);
	socket.on('api:categories.getRecentReplies', function(replies) {
		if (replies === false) {
			return;
		}
		
		var users = replies.users,
			posts = replies.posts,
			recent_replies = document.getElementById('category_recent_replies');

		recent_replies.innerHTML = '';
		for (var i=0, ii=posts.pids.length; i<ii; i++) {
			var a = document.createElement('a'),
				ul = document.createElement('ul'),
				username = users[posts.uid[i]].username,
				picture = users[posts.uid[i]].picture;

			//temp until design finalized
			ul.innerHTML = '<li><img title="' + username + '" style="width: 48px; height: 48px; /*temporary*/" src="' + picture + '" class="" />'
							+ '<p><strong>' + username + '</strong>: ' + posts.content[i] + '</p><span>posted ' + utils.relativeTime(posts.timestamp[i]) + ' ago</span></li>';
			
			a.appendChild(ul);
			recent_replies.appendChild(a);
		}
		
	});

})();
</script>