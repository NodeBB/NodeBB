<div class="account-username-box clearfix" data-userslug="{userslug}" data-uid="{uid}">

</div>

<div class="favourites">

	<!-- IF !posts.length -->
		<div class="alert alert-warning">[[topic:favourites.has_no_favourites]]</div>
	<!-- ENDIF !posts.length -->

	<div class="row">
		<div class="col-md-12 user-favourite-posts" data-nextstart="{nextStart}">
			<!-- BEGIN posts -->
			<div class="topic-row panel panel-default clearfix">
				<div class="panel-body">
					<a href="../../user/{posts.userslug}">
						<img title="{posts.username}" class="img-rounded user-img" src="{posts.picture}">
					</a>

					<a href="../../user/{posts.userslug}">
						<strong><span>{posts.username}</span></strong>
					</a>
					<p>{posts.content}</p>

					<div>
						<small>
							<span class="pull-right">
								<a href="../../topic/{posts.tid}/#{posts.pid}">posted</a>
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

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />