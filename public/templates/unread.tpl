<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a><span class="divider">/</span></li>
		<li class="active">{category_name}</li>
		<div id="category_active_users"></div>
	</ul>
</div>


<a href="/unread">
	<div class="alert hide" id="new-topics-alert"></div>
</a>

<div class="alert alert-warning {no_topics_message}" id="category-no-topics">
	<strong>There are no unread topics.</strong>
</div>

<div>
	<button id="mark-allread-btn" class="btn {show_markallread_button}">Mark All Read</button>
</div>

<div class="category row">
	<div class="{topic_row_size}">
		<ul id="topics-container" data-next-start="{nextStart}">
		<!-- BEGIN topics -->
		<a href="../../topic/{topics.slug}" id="tid-{topics.tid}">
			<li class="category-item {topics.deleted-class}">
				<div class="row-fluid">
					<div class="span12 topic-row img-polaroid">
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
			</li>
		</a>
		<!-- END topics -->
		</ul>
		<button id="load-more-btn" class="btn hide">Load More</button>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/unread.js"></script>