<ol class="breadcrumb">
	<li><a href="/">Home</a></li>
	<li class="active">{category_name}</li>
	<div id="category_active_users"></div>
</ol>

<a href="/recent">
	<div class="alert hide" id="new-topics-alert"></div>
</a>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
	<strong>There are no recent topics.</strong>
</div>

<div class="category row">
	<div class="{topic_row_size}">
		<ul id="topics-container">
		<!-- BEGIN topics -->
		<a href="../../topic/{topics.slug}" id="tid-{topics.tid}">
			<li class="category-item {topics.deleted-class}">
				<div class="row">
					<div class="col-md-12 col-xs-12 topic-row img-thumbnail">
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
						<a href="../../topic/{topics.slug}">
							<div>
								<h3><span class="topic-title"><span class="badge {topics.badgeclass}">{topics.postcount}</span>{topics.title}</span></h3>
								<small>
									<strong><i class="{topics.pin-icon}"></i> <i class="{topics.lock-icon}"></i></strong>
									Posted <span class="timeago" title="{topics.relativeTime}"></span> by
									<strong>{topics.username}</strong>.
								</small>
							</div>
						</a>
					</div>
				</div>
			</li>
		</a>
		<!-- END topics -->
		</ul>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/recent.js"></script>
