		<ol class="breadcrumb">
			<li><a href="/">Home</a></li>
			<li class="active">{category_name}</li>
		</ol>
		<ul class="topics">
			<!-- BEGIN topics -->
			<li>
				<span class="timestamp">{topics.teaser_timestamp}</span>
				<a href="../../topic/{topics.slug}">{topics.title} ({topics.postcount})</a>
				<div class="teaser">
					<img class="img-thumbnail" src="{topics.teaser_userpicture}" />
					<div class="clear"></div>
				</div>
			</li>
			<!-- END topics -->
		</ul>