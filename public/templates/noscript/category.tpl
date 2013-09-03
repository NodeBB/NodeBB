		<ol class="breadcrumb">
			<li><a href="/">Home</a></li>
			<li class="active">{category_name}</li>
			<div id="category_active_users"></div>
		</ol>
		<ul class="topics">
			<!-- BEGIN topics -->
			<li>
				<a href="../../topic/{topics.slug}">{topics.title} ({topics.postcount})</a>
				<div class="teaser">
					<img class="img-thumbnail" src="{topics.teaser_userpicture}" />
					<p>
						{topics.teaser_text} &mdash; {topics.teaser_timestamp} ago
					</p>
					<div class="clear"></div>
				</div>
			</li>
			<!-- END topics -->
		</ul>