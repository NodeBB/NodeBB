		<ul class="breadcrumb">
			<li><a href="/">Home</a><span class="divider">/</span></li>
			<li class="active">{category_name}</li>
			<div id="category_active_users"></div>
		</ul>
		<ul class="topics">
			<!-- BEGIN topics -->
			<li>
				<a href="../../topic/{topics.slug}">{topics.title} ({topics.postcount})</a>
				<div class="teaser">
					<img class="img-polaroid" src="../../graph/users/{topics.teaser_username}/picture" />
					<p>
						{topics.teaser_text} &mdash; {topics.teaser_timestamp} ago
					</p>
				</div>
			</li>
			<!-- END topics -->
		</ul>