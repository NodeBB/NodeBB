<div class="flags">

	<div class="col-lg-12">

		<div class="text-center">
			<div class="panel panel-default">
				<div class="panel-body">
					<div><canvas id="flags:daily" height="250"></canvas></div>
					<p>

					</p>
				</div>
				<div class="panel-footer"><small>Daily flags</small></div>
			</div>
		</div>

		<form id="flag-search" method="GET" action="flags">
			<div class="form-group">
				<div>
					<div>
						<label>Flags by user</label>
						<input type="text" class="form-control" id="byUsername" placeholder="Search flagged posts by username" name="byUsername" value="{byUsername}">
					</div>
				</div>
			</div>

			<div class="form-group">
				<label>Sort By</label>
				<div>
					<div>
						<select id="flag-sort-by" class="form-control" name="sortBy">
							<option value="count">Most Flags</option>
							<option value="time">Most Recent</option>
						</select>
					</div>
				</div>
			</div>

			<button type="submit" class="btn btn-primary">Search</button>
			<button class="btn btn-primary" id="dismissAll">Dismiss All</button>
		</form>

		<hr/>

		<div data-next="{next}">

			<div component="posts/flags" class="panel-group post-container" id="accordion" role="tablist" aria-multiselectable="true" data-next="{next}">
				<!-- IF !posts.length -->
				<div class="alert alert-success">
					No flagged posts!
				</div>
				<!-- ENDIF !posts.length -->

				<!-- BEGIN posts -->
				<div class="panel panel-default" component="posts/flag" data-pid="{../pid}">
					<div class="panel-heading" role="tab">
						<h4 class="panel-title">
							<a role="button" data-toggle="collapse" data-parent="#accordion" href="#flag-pid-{posts.pid}" aria-expanded="true" aria-controls="flag-pid-{posts.pid}">
								<span class="label <!-- IF ../flag.labelClassName -->{../flag.labelClassName}<!-- ELSE -->label-info<!-- ENDIF ../flag.labelClassName -->">[[topic:flag_manage_state_<!-- IF ../flag.state -->{../flag.state}<!-- ELSE -->open<!-- ENDIF ../flag.state -->]]</span>
								&nbsp;[[topic:flag_manage_title, {posts.category.name}]]
								<small><span class="timeago" title="{posts.timestampISO}"></span></small>
							</a>
						</h4>
					</div>
					<div id="flag-pid-{posts.pid}" class="panel-collapse collapse<!-- IF @first --> in<!-- ENDIF @first -->" role="tabpanel">
						<div class="panel-body">
							<div class="row" data-pid="{posts.pid}" data-tid="{posts.topic.tid}">
								<div class="col-sm-8">
									<div class="well flag-post-body">
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
										</div>
										<small>
											<span class="pull-right">
												Posted in <a href="{config.relative_path}/category/{posts.category.slug}" target="_blank"><i class="fa {posts.category.icon}"></i> {posts.category.name}</a>, <span class="timeago" title="{posts.timestampISO}"></span> &bull;
												<a href="{config.relative_path}/topic/{posts.topic.slug}/{posts.index}" target="_blank">Read More</a>
											</span>
										</small>
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
										<button class="btn btn-sm btn-success dismiss">Dismiss this Flag</button>
										<button class="btn btn-sm btn-danger delete">Delete the Post</button>
									</div>
								</div>
							</div>
							<hr />
							<div class="row">
								<div class="col-sm-6">
									<form role="form">
										<div class="form-group">
											<label for="{posts.pid}-assignee">[[topic:flag_manage_assignee]]</label>
											<select class="form-control" id="{posts.pid}-assignee" name="assignee">
												<option value="">No Assignee</option>
												<!-- BEGIN assignees -->
												<option value="{../uid}">{../username}</option>
												<!-- END assignees -->
											</select>
										</div>
										<div class="form-group">
											<label for="{posts.pid}-state">[[topic:flag_manage_state]]</label>
											<select class="form-control" id="{posts.pid}-state" name="state">
												<option value="open">[[topic:flag_manage_state_open]]</option>
												<option value="wip">[[topic:flag_manage_state_wip]]</option>
												<option value="resolved">[[topic:flag_manage_state_resolved]]</option>
												<option value="rejected">[[topic:flag_manage_state_rejected]]</option>
											</select>
										</div>
										<div class="form-group">
											<label for="{posts.pid}-notes">[[topic:flag_manage_notes]]</label>
											<textarea class="form-control" id="{posts.pid}-notes" name="notes"></textarea>
										</div>
										<button type="button" component="posts/flag/update" class="btn btn-sm btn-primary btn-block">[[topic:flag_manage_update]]</button>
									</form>
								</div>
								<div class="col-sm-6">
									<h5>[[topic:flag_manage_history]]</h5>
									<!-- IF !posts.flagData.history.length -->
									<div class="alert alert-info">[[topic:flag_manage_no_history]]</div>
									<!-- ELSE -->
									<ul class="list-group">
										<!-- BEGIN posts.flagData.history -->
										<li class="list-group-item">
											<div class="pull-right"><small><span class="timeago" title="{../timestampISO}"></span></small></div>
											Updated <span class="label label-info">{../type}</span> to {../value}
										</li>
										<!-- END posts.flagData.history -->
									</ul>
									<!-- ENDIF !posts.flagData.history.length -->
								</div>
							</div>
						</div>
					</div>
				</div>
				<!-- END posts -->
			</div>
		</div>
	</div>
</div>
