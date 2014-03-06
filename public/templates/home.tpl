<div widget-area="motd" class="hidden">
	<!-- BEGIN widgets -->
	<div class="motd">
		{widgets.html}
	</div>
	<!-- END widgets -->
</div>

<div class="row home" itemscope itemtype="http://www.schema.org/ItemList">
	<!-- BEGIN categories -->
	<div class="{categories.class}">
		<meta itemprop="name" content="{categories.name}">
		<h4>
			<!-- IF !categories.link -->
			<span class="badge {categories.unread-class}">{categories.topic_count} </span>
			<!-- ENDIF !categories.link -->

			<!-- IF categories.link -->
			<a href="{categories.link}" itemprop="url" target="_blank">
			<!-- ELSE -->
			<a href="{relative_path}/category/{categories.slug}" itemprop="url">
			<!-- ENDIF categories.link -->
			{categories.name}
			</a>
		</h4>

		<!-- IF categories.link -->
		<a href="{categories.link}" itemprop="url" target="_blank">
		<!-- ELSE -->
		<a href="{relative_path}/category/{categories.slug}" itemprop="url">
		<!-- ENDIF categories.link -->
			<div class="category-header icon category-header-image-{categories.imageClass}" style="background: {categories.background}; color: {categories.color};">
				<div id="category-{categories.cid}" class="category-slider-{categories.post_count}">
					<div class="category-box"><i class="fa {categories.icon} fa-4x"></i></div>
					<div class="category-box" itemprop="description">{categories.description}</div>
					<!-- BEGIN posts -->
					<div class="category-box">
						<div class="post-preview">
							<img src="{categories.posts.picture}" class="pull-left" />
							<p class=""><strong>{categories.posts.username}</strong>: {categories.posts.content}</p>
						</div>
					</div>
					<!-- END posts -->
					<div class="category-box"><i class="fa {categories.icon} fa-4x"></i></div>
				</div>
			</div>
		</a>
	</div>
	<!-- END categories -->
</div>

<div widget-area="footer" class="hidden">
	<!-- BEGIN widgets -->
	<div class="footer">
		{widgets.html}
	</div>
	<!-- END widgets -->
</div>