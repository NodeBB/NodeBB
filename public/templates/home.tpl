<div class="hero-unit {motd_class}">
	{motd}
</div>

<div class="row category-row">
	<!-- BEGIN categories -->
	<div class="span3">
		<a href="category/{categories.slug}">
			<h4><span class="badge {categories.badgeclass}">{categories.topic_count} </span> {categories.name}</h4>
			<div class="category-icon {categories.blockclass}">
				<div id="category-{categories.cid}" class="category-slider-{categories.post_count}">
					<div class="category-box"><i class="{categories.icon} icon-4x"></i></div>
					<div class="category-box">{categories.description}</div>
					<!-- BEGIN posts -->
					<div class="category-box">
						<div class="post-preview">
							<img src="{categories.posts.picture}" class="pull-left" />
							<p class=""><strong>{categories.posts.username}</strong>: {categories.posts.content}</p>
						</div>
					</div>
					<!-- END posts -->
					<div class="category-box"><i class="{categories.icon} icon-4x"></i></div>
				</div>
			</div>
		</a>
	</div>
	<!-- END categories -->
</div>