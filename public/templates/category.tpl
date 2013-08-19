<div class="container">
	<ul class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
			<span class="divider">/</span>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">{category_name}</span>
		</li>
		<div id="category_active_users"></div>
	</ul>
</div>

<div>
	<button id="new_post" class="btn btn-primary btn-large {show_topic_button}">New Topic</button>

	<div class="inline-block pull-right">
		<a target="_blank" href="../{category_id}.rss"><i class="icon-rss-sign icon-2x"></i></a>&nbsp;
		<a href="#" id="facebook-share"><i class="icon-facebook-sign icon-2x"></i></a>&nbsp;
		<a href="#" id="twitter-intent"><i class="icon-twitter-sign icon-2x"></i></a>&nbsp;
		<a href="#" id="google-share"><i class="icon-google-plus-sign icon-2x"></i></a>&nbsp;
	</div>
</div>

<hr/>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
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
				<div class="span12 topic-row">
					<div class="latest-post visible-desktop">
						<div class="pull-right">
							<img style="width: 48px; height: 48px; /*temporary*/" src="{topics.teaser_userpicture}" />
							<p><strong>{topics.teaser_username}</strong>: {topics.teaser_text}</p>
							<span>posted {topics.teaser_timestamp} ago</span>
						</div>
					</div>
					<div>
						<h3><span class="topic-title"><span class="badge {topics.badgeclass}">{topics.postcount}</span>{topics.title}</span></h3>
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
	</div>
	<div class="span3 {show_sidebar} category-sidebar mobile-sidebar">

		<div class="sidebar-block img-polaroid">
			<div class="block-header">
				Recent Replies
			</div>
			<div class="block-content recent-replies">
				<ul id="category_recent_replies"></ul>
			</div>
		</div>
		<div class="sidebar-block img-polaroid">
			<div class="block-header">
				Active Participants
			</div>
			<div class="block-content">
				<!-- BEGIN active_users -->
				<a href="/users/{active_users.userslug}"><img title="{active_users.username}" src="{active_users.picture}" class="img-polaroid" /></a>
				<!-- END active_users -->
			</div>
		</div>
		<div class="sidebar-block img-polaroid {moderator_block_class}">
			<div class="block-header">
				Moderators
			</div>
			<div class="block-content">
				<!-- BEGIN moderators -->
				<a href="/users/{moderators.userslug}"><img title="{moderators.username}" src="{moderators.picture}" class="img-polaroid" /></a>
				<!-- END moderators -->
			</div>
		</div>
	</div>
</div>

<input type="hidden" template-variable="category_id" value="{category_id}" />
<input type="hidden" template-variable="twitter-intent-url" value="{twitter-intent-url}" />
<input type="hidden" template-variable="facebook-share-url" value="{facebook-share-url}" />
<input type="hidden" template-variable="google-share-url" value="{google-share-url}" />

<script type="text/javascript" src="{relative_path}/src/forum/category.js"></script>