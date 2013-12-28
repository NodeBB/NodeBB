<div class="well favourites">
	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="/user/{userslug}">{username}</a> <i class="fa fa-chevron-right"></i>
			<a href="/user/{userslug}/favourites">[[topic:favourites]]</a>
		</span>
	</div>

	<!-- IF show_nofavourites -->
		<div id="no-favourites-notice" class="alert alert-warning">[[topic:has_no_favourites]]</div>
	<!-- ENDIF show_nofavourites -->

	<div class="row">
		<div class="col-md-12 user-favourite-posts">
			<!-- BEGIN posts -->
			<div class="topic-row img-thumbnail clearfix">
				<a href="../../user/{posts.userslug}">
					<img title="{posts.username}" class="img-rounded user-img" src="{posts.picture}">
				</a>

				<a href="../../user/{posts.userslug}">
					<strong><span>{posts.username}</span></strong>
				</a>
				<p>{posts.content}</p>

				<div>
					<span class="pull-right">
						<a href="../../topic/{posts.tid}/#{posts.pid}">posted</a>
						in
						<a href="../../category/{posts.categorySlug}">
							<i class="fa {posts.categoryIcon}"></i> {posts.categoryName}
						</a>
						<span class="timeago" title="{posts.relativeTime}"></span>
					</span>
				</div>
			</div>
			<br/>
			<!-- END posts -->
		</div>
	</div>
</div>
