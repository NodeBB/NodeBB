<ul id="quick-search-results" class="quick-search-results">
{{{each posts}}}
<li data-tid="{posts.topic.tid}" data-pid="{posts.pid}">
	<a href="{config.relative_path}/post/{posts.pid}" class="deco-none">
		{buildAvatar(posts.user, "sm", true)}
		<span class="quick-search-title">{posts.topic.title}</span>
		<br/>
		<p class="snippet">
		{posts.snippet}
		</p>
		<small class="post-info pull-right">
			<span class="fa-stack" style="{function.generateCategoryBackground, posts.category}"><i style="color:{posts.category.color};" class="fa {posts.category.icon} fa-stack-1x"></i></span> {posts.category.name} &bull;
			<span class="timeago" title="{posts.timestampISO}"></span>
		</small>
	 </a>
</li>
<!-- IF !@last -->
<li role="separator" class="divider"></li>
<!-- ENDIF -->
{{{end}}}
</ul>
<!-- IF multiplePages -->
<div class="text-center">
	<a href="{url}">
		[[search:see-more-results, {matchCount}]]
	</a>
</div>
<!-- ENDIF multiplePages -->
{{{if !posts.length}}}
<div class="text-center no-results">[[search:no-matches]]</li>
{{{end}}}