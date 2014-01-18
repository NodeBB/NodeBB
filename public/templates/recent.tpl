<ol class="breadcrumb">
	<li><a href="{relative_path}/">主页</a></li>
	<li class="active">最近<a href="{relative_path}/recent.rss"><i class="fa fa-rss-square"></i></a></li>
</ol>

<ul class="nav nav-pills">
	<li class=''><a href='{relative_path}/recent/day'>[[recent:day]]</a></li>
	<li class=''><a href='{relative_path}/recent/week'>[[recent:week]]</a></li>
	<li class=''><a href='{relative_path}/recent/month'>[[recent:month]]</a></li>
</ul>

<br />

<a href="{relative_path}/recent">
	<div class="alert alert-warning hide" id="new-topics-alert"></div>
</a>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
	<strong>最近没有新主题。</strong>
</div>

<div class="category row">
	<div class="col-md-12">
		<ul id="topics-container">
		<!-- BEGIN topics -->
		<li class="category-item {topics.deleted-class}">
			<div class="row">
				<div class="col-md-12 col-xs-12 topic-row img-thumbnail">

					<a href="{relative_path}/topic/{topics.slug}">
						<h3><span class="topic-title"><strong><i class="fa {topics.pin-icon}"></i> <i class="fa {topics.lock-icon}"></i></strong> {topics.title}</span></h3>
					</a>
					<small>
						<span class="topic-stats">
							posts
							<strong class="human-readable-number" title="{topics.postcount}">{topics.postcount}</strong>
						</span>
						|
						<span class="topic-stats">
							views
							<strong class="human-readable-number" title="{topics.viewcount}">{topics.viewcount}</strong>
						</span>
						|
						<span>
							<a href="{relative_path}/user/{topics.userslug}">
								<img class="teaser-pic" src="{topics.picture}" title="{topics.username}"/>
							</a>
							发布于
							<a href="{relative_path}/category/{topics.categorySlug}">
								<i class="fa {topics.categoryIcon}"></i> {topics.categoryName}
							</a>
							<span class="timeago" title="{topics.relativeTime}"></span>
							</span>
						</span>

						<span class="pull-right hidden-xs">
							<!-- IF topics.unreplied -->
							还没有回复
							<!-- ELSE -->
							<a href="{relative_path}/user/{topics.teaser_userslug}">
								<img class="teaser-pic" src="{topics.teaser_userpicture}" title="{topics.teaser_username}"/>
							</a>
							<a href="{relative_path}/topic/{topics.slug}#{topics.teaser_pid}">
								回复
							</a>
							<span class="timeago" title="{topics.teaser_timestamp}"></span>
							<!-- ENDIF topics.unreplied -->
						</span>
					</small>
				</div>
			</div>
		</li>
		<!-- END topics -->
		</ul>
	</div>
</div>
