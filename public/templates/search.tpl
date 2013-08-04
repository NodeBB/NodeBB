<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a><span class="divider">/</span></li>
		<li class="active">Search</li>
	</ul>
</div>


<div class="alert alert-warning {show_no_results}" id="no-search-results">
	<strong>No search results for {search_query}.</strong>
</div>

<div class="category row">
	<div class="span12">
		<ul id="topics-container">
		<!-- BEGIN posts -->
		<a href="../../topic/{posts.topicSlug}#{posts.pid}" id="tid-{posts.tid}">
			<li class="category-item">
				<div class="row-fluid">
					<div class="span12 img-polaroid">
						<div class="search-result-post">
							<img src="{posts.picture}" />
							<strong>{posts.username}</strong>: {posts.content}
						</div>

					</div>
				</div>
			</li>
		</a>
		<!-- END posts -->
		</ul>
	</div>
</div>
<!--
<script type="text/javascript" src="{relative_path}/src/forum/search.js"></script>
-->