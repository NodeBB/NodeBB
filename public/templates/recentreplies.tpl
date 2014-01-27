
<!-- BEGIN posts -->
<li data-pid="{posts.pid}" class="clearfix">
	<a href="{relative_path}/user/{posts.userslug}">
		<img title="{posts.username}" class="img-rounded user-img" src="{posts.picture}" />
	</a>
	<strong><span>{posts.username}</span></strong>
	<p>posts.content</p>
	<span class="pull-right">
		<a href="{relative_path}/topic/{posts.topicSlug}#{posts.pid}">[[category:posted]]</a>
		<span class="timeago" title="{posts.relativeTime}"></span>
	</span>
</li>
<!-- END posts -->
