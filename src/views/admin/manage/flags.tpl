<div class="flags">
	<div class="col-lg-9">
		<div data-next="{next}">
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

				<button type="submit" class="btn btn-primary">Search</button>
			</form>
			<br />
			<hr/>

			<div class="post-container" data-next="{next}">
				<!-- IF !posts.length -->
				<div class="alert alert-success">
					No flagged posts!
				</div>
				<!-- ENDIF !posts.length -->

				<!-- BEGIN posts -->
				<div class="row" data-pid="{posts.pid}" data-tid="{posts.topic.tid}">
					<div class="col-sm-8">
						<div class="panel panel-default">
							<div class="panel-body flag-post-body">
								<a href="{config.relative_path}/user/{../user.userslug}">
									<!-- IF ../user.picture -->
									<img title="{posts.user.username}" src="{../user.picture}">
									<!-- ELSE -->
									<div class="user-icon" style="background-color: {../user.icon:bgColor};">{../user.icon:text}</div>
									<!-- ENDIF ../user.picture -->
								</a>

								<a href="{config.relative_path}/user/{../user.userslug}">
									<strong><span>{../user.username}</span></strong>
								</a>
								<div class="content">
									<p>{posts.content}</p>
									<p class="fade-out"></p>
								</div>
								<small>
									<span class="pull-right">
										Posted in <a href="{config.relative_path}/category/{posts.category.slug}" target="_blank"><i class="fa {posts.category.icon}"></i> {posts.category.name}</a>, <span class="timeago" title="{posts.timestampISO}"></span> &bull;
										<a href="{config.relative_path}/topic/{posts.topic.slug}/{posts.index}" target="_blank">Read More</a>
									</span>
								</small>
							</div>
						</div>
					</div>
					<div class="col-sm-4">
						<i class="fa fa-flag"></i> This post has been flagged {posts.flags} time(s):
						<blockquote class="flag-reporters">
							<ul>
								<!-- BEGIN posts.flagReasons -->
								<li>
									<a target="_blank" href="{config.relative_path}/user/{../user.userslug}">
										<!-- IF ../user.picture -->
										<img src="{../user.picture}" />
										<!-- ELSE -->
										<div class="user-icon" style="background-color: {../user.icon:bgColor};">{../user.icon:text}</div>
										<!-- ENDIF ../user.picture -->
										{../user.username}
									</a>: "{../reason}"
								</li>
								<!-- END posts.flagReasons -->
							</ul>
						</blockquote>
						<div class="btn-group">
							<button class="btn btn-sm btn-success dismiss">Dismiss</button>
							<button class="btn btn-sm btn-danger delete">Delete</button>
						</div>
					</div>
				</div>
				<!-- END posts -->
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
