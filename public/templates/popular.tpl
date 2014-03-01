<ol class="breadcrumb">
	<li><a href="{relative_path}/">[[global:home]]</a></li>
	<li class="active">[[global:header.popular]] <a href="{relative_path}/popular.rss"><i class="fa fa-rss-square"></i></a></li>
</ol>

<ul class="nav nav-pills">
	<li class=''><a href='{relative_path}/popular/posts'>[[global:posts]]</a></li>
	<li class=''><a href='{relative_path}/popular/views'>[[global:views]]</a></li>
</ul>

<br />

<a href="{relative_path}/popular">
	<div class="alert alert-warning hide" id="new-topics-alert"></div>
</a>

<!-- IF !topics.length -->
<div class="alert alert-warning" id="category-no-topics">
	<strong>There are no popular topics.</strong>
</div>
<!-- ENDIF !topics.length -->

<div class="category row">
	<div class="col-md-12">
		<ul id="topics-container" data-nextstart="{nextStart}">
		<!-- BEGIN topics -->
		<li class="category-item <!-- IF topics.deleted --> deleted<!-- ENDIF topics.deleted --><!-- IF topics.unread --> unread<!-- ENDIF topics.unread -->">
			<div class="col-md-12 col-xs-12 panel panel-default topic-row">
				<a href="{relative_path}/user/{topics.userslug}" class="pull-left">
					<img class="img-rounded user-img" src="{topics.picture}" title="{topics.username}" />
				</a>

				<h3>
					<a href="{relative_path}/topic/{topics.slug}">
						<strong><!-- IF topics.pinned --><i class="fa fa-thumb-tack"></i><!-- ENDIF topics.pinned --> <!-- IF topics.locked --><i class="fa fa-lock"></i><!-- ENDIF topics.locked --></strong>
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
						<a href="{relative_path}/category/{topics.category.slug}">
							<i class="fa {topics.category.icon}"></i> {topics.category.name}
						</a>
						<span class="timeago" title="{topics.relativeTime}"></span>
						</span>
					</span>

					<span class="pull-right">
						<!-- IF topics.unreplied -->
						[[category:no_replies]]
						<!-- ELSE -->
						<a href="{relative_path}/user/{topics.teaser.userslug}">
							<img class="teaser-pic" src="{topics.teaser.picture}" title="{topics.teaser.username}"/>
						</a>
						<a href="{relative_path}/topic/{topics.slug}#{topics.teaser.pid}">
							[[category:replied]]
						</a>
						<span class="timeago" title="{topics.teaser.timestamp}"></span>
						<!-- ENDIF topics.unreplied -->
					</span>
				</small>
			</div>
		</li>
		<!-- END topics -->
		</ul>
	</div>
</div>
