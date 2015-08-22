<div class="flags">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-flag"></i> [[admin:flags.flags]]</div>
			<div class="panel-body" data-next="{next}">
				<form id="flag-search" method="GET" action="flags">
					<div class="form-group">
						<div class="row">
							<div class="col-md-6">
								<label>[[admin:flags.flags_by_user]]</label>
								<input type="text" class="form-control" id="byUsername" placeholder="[[admin:flags.flags_by_user_placeholder]]" name="byUsername" value="{byUsername}">
							</div>
						</div>
					</div>

					<div class="form-group">
						<label>[[admin:flags.sort_by]]</label>
						<div class="row">
							<div class="col-md-6">
								<select id="flag-sort-by" class="form-control" name="sortBy">
									<option value="count">[[admin:flags.most_flags]]</option>
									<option value="time">[[admin:flags.most_recent]]</option>
								</select>
							</div>
						</div>
					</div>

					<button type="submit" class="btn btn-default">[[global:search]]</button>
				</form>
				<hr/>

				<div class="post-container" data-next="{next}">
					<!-- IF !posts.length -->
					[[admin:flags.no_flagged_posts]]
					<!-- ENDIF !posts.length-->

					<!-- BEGIN posts -->
					<div>
						<div class="panel panel-default" data-pid="{posts.pid}" data-tid="{posts.topic.tid}">
							<div class="panel-body">
								<a href="{config.relative_path}/user/{posts.user.userslug}">
									<img title="{posts.user.username}" class="img-rounded user-img" src="{posts.user.picture}">
								</a>

								<a href="{config.relative_path}/user/{posts.user.userslug}">
									<strong><span>{posts.user.username}</span></strong>
								</a>
								<div class="content">
									<p>{posts.content}</p>
									<p class="fade-out"></p>
								</div>
								<small>
									<span class="pull-right">
										[[admin:flags.posted_in]]<a href="{config.relative_path}/category/{posts.category.slug}" target="_blank"><i class="fa {posts.category.icon}"></i> {posts.category.name}</a>, <span class="timeago" title="{posts.relativeTime}"></span> &bull;
										<a href="{config.relative_path}/topic/{posts.topic.slug}/{posts.index}" target="_blank">[[admin:flags.read_more]]</a>
									</span>
								</small>
							</div>
						</div>

						<span class="badge badge-warning"><i class="fa fa-flag"></i> {posts.flags}</span>
						<button class="btn btn-warning dismiss">[[admin:flags.dismiss]]</button>
						<button class="btn btn-danger delete">[[admin:flags.delete]]</button>
						<br/><br/>
					</div>
					<!-- END posts -->
				</div>
			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:flags.flags_control_panel]]</div>
			<div class="panel-body">
				<div>
					<button class="btn btn-primary" id="dismissAll">[[admin:flags.dismiss_all]]</button>
				</div>
			</div>
		</div>
	</div>
</div>
