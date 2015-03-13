<div class="flags">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-flag"></i> Flags</div>
			<div class="panel-body" data-next="{next}">
				<form id="flag-search" method="GET" action="flags">
					<div class="form-group">
						<div class="row">
							<div class="col-md-6">
								<label>Flags by user</label>
								<input type="text" class="form-control" id="byUsername" placeholder="Search flagged posts by username" name="byUsername" value="{byUsername}">
							</div>
						</div>
					</div>

					<div class="form-group">
						<label>Sort By</label>
						<div class="row">
							<div class="col-md-6">
								<select id="flag-sort-by" class="form-control" name="sortBy">
									<option value="count">Most Flags</option>
									<option value="time">Most Recent</option>
								</select>
							</div>
						</div>
					</div>

					<button type="submit" class="btn btn-default">[[global:search]]</button>
				</form>
				<hr/>

				<div class="post-container" data-next="{next}">
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
									<span class="pull-right">
										Posted in <a href="{relative_path}/category/{posts.category.slug}" target="_blank"><i class="fa {posts.category.icon}"></i> {posts.category.name}</a>, <span class="timeago" title="{posts.relativeTime}"></span> &bull;
										<a href="{relative_path}/topic/{posts.topic.slug}/{posts.index}" target="_blank">Read More</a>
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
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Flags Control Panel</div>
			<div class="panel-body">
				<div>
					<button class="btn btn-primary" id="dismissAll">Dismiss All</button>
				</div>
			</div>
		</div>
	</div>
</div>
