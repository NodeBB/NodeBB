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
	<div class="span3 {show_category_features} category-sidebar">
		<div class="sidebar-block img-polaroid">
			<div class="block-header">
				<a target="_blank" href="../{category_id}.rss"><i class="icon-rss-sign icon-2x"></i></a>&nbsp;
				<i class="icon-facebook-sign icon-2x"></i>&nbsp;
				<i class="icon-twitter-sign icon-2x"></i>&nbsp;
				<i class="icon-google-plus-sign icon-2x"></i>&nbsp;
			</div>
		</div>
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
				<a href="/users/{active_users.username}"><img title="{active_users.username}" src="/graph/users/{active_users.username}/picture" class="img-polaroid" /></a>
				<!-- END active_users -->
			</div>
		</div>
		<div class="sidebar-block img-polaroid {moderator_block_class}">
			<div class="block-header">
				Moderators
			</div>
			<div class="block-content">
				<!-- BEGIN moderators -->
				<a href="/users/{moderators.username}"><img title="{moderators.username}" src="/graph/users/{moderators.username}/picture" class="img-polaroid" /></a>
				<!-- END moderators -->
			</div>
		</div>
	</div>
</div>




<input type="hidden" template-variable="category_id" value="{category_id}" />
<script type="text/javascript" src="/src/forum/category.js"></script>