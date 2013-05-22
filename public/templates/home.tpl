<div class="hero-unit">
	{motd}
</div>

<div class="row category-row">
	<!-- BEGIN categories -->
	<div class="span3">
		<a href="category/{categories.slug}">
			<h4>{categories.name} <span class="badge {categories.badgeclass}">{categories.topic_count}</span></h4>
			<!-- {categories.description} -->
			<div class="category-icon {categories.blockclass}">
				<i class="{categories.icon} icon-4x"></i>
			</div>
		</a>
	</div>
	<!-- END categories -->
</div>