<div class="unread">
	<ol class="breadcrumb">
		<li><a href="{relative_path}/">[[global:home]]</a></li>
		<li class="active">[[unread:title]]</li>
	</ol>


	<div class="alert alert-warning {no_topics_message}" id="category-no-topics">
		<strong>[[unread:no_unread_topics]]</strong>
	</div>

	<button id="mark-allread-btn" class="btn btn-primary {show_markallread_button}">[[unread:mark_all_read]]</button>

	<a href="{relative_path}/unread">
		<div class="alert alert-warning hide" id="new-topics-alert"></div>
	</a>

	<div class="category row">
		<div class="col-md-12">
			<ul id="topics-container" data-nextstart="{nextStart}">
			<!-- BEGIN topics -->
			<li class="category-item {topics.deleted-class}">
				<div class="col-md-12 col-xs-12 panel panel-default topic-row">
					<a href="{relative_path}/user/{topics.userslug}" class="pull-left">
						<img class="img-rounded user-img" src="{topics.picture}" title="{topics.username}" />
					</a>
					<h3>
						<a href="{relative_path}/topic/{topics.slug}">
							<strong><i class="fa {topics.pin-icon}"></i><i class="fa {topics.lock-icon}"></i></strong>
							<span class="topic-title">{topics.title}</span>
						</a>
					</h3>

					<small>
						<span class="topic-stats">
							[[category:posts]]
							<strong class="human-readable-number" title="{topics.postcount}">{topics.postcount}</strong>
						</span>
						|
						<span class="topic-stats">
							[[category:views]]
							<strong class="human-readable-number" title="{topics.viewcount}">{topics.viewcount}</strong>
						</span>
						|
						<span>
							[[category:posted]] [[global:in]]
							<a href="{relative_path}/category/{topics.categorySlug}">
								<i class="fa {topics.categoryIcon}"></i> {topics.categoryName}
							</a>
							<span class="timeago" title="{topics.relativeTime}"></span>
							</span>
						</span>

						<span class="pull-right">
							<!-- IF topics.unreplied -->
							[[category:no_replies]]
							<!-- ELSE -->
							<a href="{relative_path}/user/{topics.teaser_userslug}">
								<img class="teaser-pic" src="{topics.teaser_userpicture}" title="{topics.teaser_username}"/>
							</a>
							<a href="{relative_path}/topic/{topics.slug}#{topics.teaser_pid}">
								[[category:replied]]
							</a>
							<span class="timeago" title="{topics.teaser_timestamp}"></span>
							<!-- ENDIF topics.unreplied -->
						</span>
					</small>
				</div>
			</li>
			<!-- END topics -->
			</ul>
			<button id="load-more-btn" class="btn btn-primary hide">[[unread:load_more]]</button>
		</div>
	</div>
</div>
