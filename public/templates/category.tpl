<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">{category_name} <a target="_blank" href="../{category_id}.rss"><i class="icon-rss-sign"></i></a></span>
	</li>
	<div id="category_active_users"></div>
</ol>

<div>
	<button id="new_post" class="btn btn-primary btn-lg {show_topic_button}">[[category:new_topic_button]]</button>

	<div class="inline-block pull-right">
		<a href="#" id="facebook-share"><i class="icon-facebook-sign icon-2x"></i></a>&nbsp;
		<a href="#" id="twitter-intent"><i class="icon-twitter-sign icon-2x"></i></a>&nbsp;
		<a href="#" id="google-share"><i class="icon-google-plus-sign icon-2x"></i></a>&nbsp;
	</div>
</div>

<hr/>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
	[[category:no_topics]]
</div>

<div class="category row">
	<div class="{topic_row_size}">
		<ul id="topics-container">
		<!-- BEGIN topics -->

			<li class="category-item {topics.deleted-class}">
				<div class="row">
					<div class="col-md-12 topic-row">
						<div class="latest-post visible-lg visible-md">
							<a href="../../topic/{topics.slug}#{topics.teaser_pid}">
								<div class="pull-right">
									<img class="img-rounded" style="width: 48px; height: 48px; /*temporary*/" src="{topics.teaser_userpicture}" />
									<p>{topics.teaser_text}</p>
									<p class="meta">
										<strong>{topics.teaser_username}</strong> posted <span class="timeago" title="{topics.teaser_timestamp}"></span>
									</p>
								</div>
							</a>
						</div>
						
							<div>
								<h3><span class="topic-title"><span class="badge {topics.badgeclass}">{topics.postcount}</span>{topics.title}</span></h3>
								<small>
									<strong><i class="{topics.pin-icon}"></i> <i class="{topics.lock-icon}"></i></strong>
									Posted <span class="timeago" title="{topics.relativeTime}"></span> by
									<strong>{topics.username}</strong>.
								</small>
							</div>
						
					</div>
				</div>
			</li>

		<!-- END topics -->
		</ul>
	</div>
	<div class="col-md-3 {show_sidebar} category-sidebar">

		<div class="sidebar-block img-thumbnail">
			<div class="block-header">
				[[category:sidebar.recent_replies]]
			</div>
			<div class="block-content recent-replies">
				<ul id="category_recent_replies"></ul>
			</div>
		</div>
		<div class="sidebar-block img-thumbnail">
			<div class="block-header">
				[[category:sidebar.active_participants]]
			</div>
			<div class="block-content">
				<!-- BEGIN active_users -->
				<a href="/user/{active_users.userslug}"><img title="{active_users.username}" src="{active_users.picture}" class="img-rounded" /></a>
				<!-- END active_users -->
			</div>
		</div>
		<div class="sidebar-block img-thumbnail {moderator_block_class}">
			<div class="block-header">
				[[category:sidebar.moderators]]
			</div>
			<div class="block-content">
				<!-- BEGIN moderators -->
				<a href="/user/{moderators.userslug}"><img title="{moderators.username}" src="{moderators.picture}" class="img-rounded" /></a>
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