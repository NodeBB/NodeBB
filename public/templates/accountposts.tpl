<div class="account-username-box clearfix" data-userslug="{userslug}" data-uid="{uid}">

</div>

<div class="favourites">

	<!-- IF !posts.length -->
		<div class="alert alert-warning">[[user:has_no_posts]]</div>
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
								<a href="../../topic/{posts.topic.slug}#{posts.pid}">[[global:posted]]</a>
								[[global:in]]
								<a href="../../category/{posts.category.slug}">
									<i class="fa {posts.category.icon}"></i> {posts.category.name}
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