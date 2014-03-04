<ol class="breadcrumb">
	<li><a href="{relative_path}/">[[global:home]]</a></li>
	<li class="active">[[global:search]]</li>
</ol>


<form id="mobile-search-form" class="navbar-form navbar-right visible-xs" role="search" method="GET" action="">
	<div class="" id="search-fields">
		<div class="form-group">
			<input type="text" class="form-control" placeholder="[[global:search]]" name="query" value="">
		</div>
		<button type="submit" class="btn btn-default hide">[[global:search]]</button>
	</div>
</form>

<div class="search">
	<div class="{show_results} row">

		<div id="topic-results" class="col-md-12" data-search-query="{search_query}">

			<h3>[[topic:topics]]</h3>

			<!-- IF topic_matches -->
			<small>{topic_matches} result(s) matching "{search_query}"</small>
			<!-- ENDIF topic_matches -->
			<div class="alert alert-info {show_no_topics}">[[topic:no_topics_found]]</div>

			<!-- BEGIN topics -->
			<div class="topic-row panel panel-default clearfix">
				<div class="panel-body">


					<a href="../../topic/{topics.slug}" class="search-result-text">
						{topics.title}
					</a>

					<div>
						<small>
							<span class="pull-right">
								<a href="../../user/{topics.userslug}"><img title="{topics.username}" class="img-rounded user-img" src="{topics.picture}"></a>
								<a href="../../topic/{topics.slug}"> [[global:posted]]</a>
								[[global:in]]
								<a href="../../category/{topics.category.slug}"><i class="fa {topics.category.icon}"></i> {topics.category.name}</a>
								<span class="timeago" title="{topics.relativeTime}"></span>
							</span>
						</small>
					</div>
				</div>
			</div>
			<!-- END topics -->
		</div>

		<div id="post-results" class="col-md-12" data-search-query="{search_query}">
			<h3>[[topic:posts]]</h3>

			<!-- IF post_matches -->
			<small>{post_matches} result(s) matching "{search_query}"</small>
			<!-- ENDIF post_matches -->
			<div class="alert alert-info {show_no_posts}">[[tropic:no_posts_found]]</div>

			<!-- BEGIN posts -->
			<div class="topic-row panel panel-default clearfix">
				<div class="panel-body">
					<a href="../../topic/{posts.topicSlug}#{posts.pid}" class="search-result-text">
						{posts.content}
					</a>

					<div>
						<small>
							<span class="pull-right">
								<a href="../../user/{posts.userslug}">
									<img title="{posts.username}" class="img-rounded user-img" src="{posts.picture}">
								</a>
								<a href="../../topic/{posts.topicSlug}#{posts.pid}">posted</a>
								in
								<a href="../../category/{posts.categorySlug}">
									<i class="fa {posts.categoryIcon}"></i> {posts.categoryName}
								</a>
								<span class="timeago" title="{posts.relativeTime}"></span>
							</span>
						</small>
					</div>
				</div>
			</div>
			<!-- END posts -->
		</div>
	</div>
</div>
