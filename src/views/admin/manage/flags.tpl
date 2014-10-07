<div class="flags">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-flag"></i> Flags</div>
			<div class="panel-body post-container" data-next="{next}">

				<!-- IF !posts.length -->
				No flagged posts!
				<!-- ENDIF !posts.length-->

				<!-- BEGIN posts -->
				<div>
					<div class="panel panel-default" data-pid="{posts.pid}" data-tid="{posts.topic.tid}">
						<div class="panel-body">
							<a href="{relative_path}/user/{posts.user.userslug}">
								<img title="{posts.user.username}" class="img-rounded user-img" src="{posts.user.picture}">
							</a>

							<a href="{relative_path}/user/{posts.user.userslug}">
								<strong><span>{posts.user.username}</span></strong>
							</a>
							<div class="content">
								<p>{posts.content}</p>
								<p class="fade-out"></p>
							</div>
							<small>
								<span class="pull-right footer">
									Posted in <a href="{relative_path}/category/{posts.category.slug}"><i class="fa {posts.category.icon}"></i> {posts.category.name}</a>, <span class="timeago" title="{posts.relativeTime}"></span> &bull;
									<a href="{relative_path}/topic/{posts.topic.slug}/{posts.index}">Read More</a>
								</span>
							</small>
						</div>
					</div>

					<span class="badge badge-warning"><i class="fa fa-flag"></i> {posts.flags}</span>
					<button class="btn btn-warning dismiss">Dismiss</button>
					<button class="btn btn-danger delete">Delete</button>
					<br/><br/>
				</div>
				<!-- END posts -->
			</div>
		</div>
	</div>
</div>


