<div class="registration">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-group"></i> Registration Queue</div>
			<div class="panel-body">
				<table class="table table-striped users-list">
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>IP</th>
						<th>Time</th>
						<th></th>
					</tr>
					<!-- BEGIN users -->
					<tr data-username="{users.username}">
						<td>
							{users.username}
						</td>
						<td>
							{users.email}
						</td>
						<td>
							{users.ip}
						</td>
						<td>
							<span class="timeago" title="{users.timestamp}"></span>
						</td>
						<td>
							<div class="btn-group pull-right">
								<button class="btn btn-success btn-xs" data-action="accept"><i class="fa fa-check"></i></button>
								<button class="btn btn-danger btn-xs" data-action="delete"><i class="fa fa-times"></i></button>
							</div>
						</td>
					</tr>
					<!-- END users -->
				</table>
			</div>
		</div>
	</div>
</div>