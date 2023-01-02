<div id="results" class="search-results col-md-12" data-search-query="{search_query}">
	<!-- IF matchCount -->
	<div class="alert alert-info">[[search:results_matching, {matchCount}, {search_query}, {time}]] </div>
	<!-- ELSE -->
	<!-- IF search_query -->
	<div class="alert alert-warning">[[search:no-matches]]</div>
	<!-- ENDIF search_query -->
	<!-- ENDIF matchCount -->

	{{{each posts}}}
	<div class="topic-row panel panel-default clearfix">
		<div class="panel-body">
			<a href="{config.relative_path}/user/{posts.user.userslug}">{buildAvatar(posts.user, "sm", true)}</a>
			<span class="search-result-text search-result-title"><a href="{config.relative_path}/post/{posts.pid}">{posts.topic.title}</a></span>
			<br/>
			<!-- IF showAsPosts -->
			<div class="search-result-text">
				{posts.content}
				<p class="fade-out"></p>
			</div>
			<!-- ENDIF showAsPosts -->

			<small class="post-info pull-right">
				<a href="{config.relative_path}/category/{posts.category.slug}"><span class="fa-stack" style="{function.generateCategoryBackground, posts.category}"><i style="color:{posts.category.color};" class="fa {posts.category.icon} fa-stack-1x"></i></span> {posts.category.name}</a> &bull;
				<span class="timeago" title="{posts.timestampISO}"></span>
			</small>
		</div>
	</div>
	{{{end}}}

	<!-- IF users.length -->
	<ul id="users-container" class="users-container">
	<!-- IMPORT partials/users_list.tpl -->
	</ul>
	<!-- ENDIF users.length -->

	<!-- IF tags.length -->
	<!-- IMPORT partials/tags_list.tpl -->
	<!-- ENDIF tags.length -->

	{{{ if categories.length }}}
	<ul class="categories">
		{{{each categories}}}
		<!-- IMPORT partials/categories/item.tpl -->
		{{{end}}}
	</ul>
	{{{ end }}}

	<!-- IMPORT partials/paginator.tpl -->
</div>