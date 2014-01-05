<ol class="breadcrumb">
	<li><a href="{relative_path}/">[[global:home]]</a></li>
	<li class="active">[[global:header.search]]</li>
</ol>


<form id="mobile-search-form" class="navbar-form navbar-right visible-xs" role="search" method="GET" action="">
	<div class="" id="search-fields">
		<div class="form-group">
			<input type="text" class="form-control" placeholder="Search" name="query" value="">
		</div>
		<button type="submit" class="btn btn-default hide">[[global:header.search]]</button>
	</div>
</form>

<div class="category search">
	<div class="{show_results}">
		<h3>[[topic:topics]]</h3>

		<!-- IF topic_matches -->
		<small>{topic_matches} result(s) matching "{search_query}"</small>
		<!-- ENDIF topic_matches -->
		<div class="alert alert-info {show_no_topics}">[[topic:no_topics_found]]</div>

		<ul id="topics-container" data-search-query="{search_query}">

			<!-- BEGIN topics -->
			<li class="category-item">
				<a href="{relative_path}/topic/{topics.slug}" id="tid-{topics.tid}">
					<div>
						<div class="col-md-12 img-thumbnail">
							<div class="search-result-post">
								<img src="{topics.teaser_userpicture}" />
								<strong>{topics.teaser_username}</strong>: <span class="search-result-text">{topics.title}</span>
							</div>

						</div>
					</div>
				</a>
			</li>
			<!-- END topics -->
		</ul>

		<h3>Posts</h3>
		<!-- IF post_matches -->
		<small>{post_matches} result(s) matching "{search_query}"</small>
		<!-- ENDIF post_matches -->
		<div class="alert alert-info {show_no_posts}">No posts found!</div>

		<ul id="topics-container" data-search-query="{search_query}">
			<!-- BEGIN posts -->
			<li class="category-item">
				<a href="{relative_path}/topic/{posts.topicSlug}#{posts.pid}" id="tid-{posts.tid}">
					<div>
						<div class="col-md-12 img-thumbnail">
							<div class="search-result-post">
								<img src="{posts.picture}" />
								<strong>{posts.username}</strong>: <span class="search-result-text">{posts.content}</span>
							</div>

						</div>
					</div>
				</a>
			</li>
			<!-- END posts -->
		</ul>
	</div>
</div>
