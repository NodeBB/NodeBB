<div class="row">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-folder"></i> Active Categories</div>
			<div class="panel-body">
				<table class="table table-striped table-hover table-reordering">
					<thead>
						<tr>
							<th></th>
							<th>Name</th>
							<th>Description</th>
							<th class="text-center">Topics</th>
							<th class="text-center">Posts</th>
							<th></th>
						</tr>
					</thead>
					<tbody id="active-categories">
						<!-- IF active.length -->
						<!-- BEGIN active -->
						<tr data-cid="{active.cid}">
							<td>
								<span class="label" style="
									<!-- IF active.backgroundImage -->background-image: url({active.backgroundImage});<!-- ENDIF active.backgroundImage -->
									<!-- IF active.bgColor -->background-color: {active.bgColor};<!-- ENDIF active.bgColor -->
									color: {active.color};
									background-size:cover;
								">
									<i data-name="icon" value="{active.icon}" class="fa fa-fw {active.icon}"></i>
								</span>
							</td>
							<td>{active.name}</td>
							<td>{active.description}</td>
							<td class="text-center">{active.topic_count}</td>
							<td class="text-center">{active.post_count}</td>
							<td>
								<div class="btn-group">
									<a href="./categories/{active.cid}" class="btn btn-default btn-xs">Edit</a>
									<button data-action="toggle" data-disabled="{active.disabled}" class="btn btn-default btn-xs">Disable</button>
								</div>
							</td>
						</tr>
						<!-- END active -->
						<!-- ELSE -->
						<tr>
							<td colspan="6">
								<div class="alert alert-info text-center">
									You have no active categories.
								</div>
							</td>
						</tr>
						<!-- ENDIF active.length -->
					</tbody>
				</table>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-folder"></i> Disabled Categories</div>
			<div class="panel-body">
				<table class="table table-striped table-hover table-reordering">
					<thead>
						<tr>
							<th></th>
							<th>Name</th>
							<th>Description</th>
							<th class="text-center">Topics</th>
							<th class="text-center">Posts</th>
							<th></th>
						</tr>
					</thead>
					<tbody id="disabled-categories">
						<!-- IF disabled.length -->
						<!-- BEGIN disabled -->
						<tr data-cid="{disabled.cid}">
							<td>
								<span class="label" style="
									<!-- IF disabled.backgroundImage -->background-image: url({disabled.backgroundImage});<!-- ENDIF disabled.backgroundImage -->
									<!-- IF disabled.bgColor -->background-color: {disabled.bgColor};<!-- ENDIF disabled.bgColor -->
									color: {disabled.color};
									background-size:cover;
								">
									<i data-name="icon" value="{disabled.icon}" class="fa fa-fw {disabled.icon}"></i>
								</span>
							</td>
							<td>{disabled.name}</td>
							<td>{disabled.description}</td>
							<td class="text-center">{disabled.topic_count}</td>
							<td class="text-center">{disabled.post_count}</td>
							<td>
								<div class="btn-group">
									<a href="./categories/{disabled.cid}" class="btn btn-default btn-xs">Edit</a>
									<button data-action="toggle" data-disabled="{disabled.disabled}" class="btn btn-default btn-xs">Enable</button>
								</div>
							</td>
						</tr>
						<!-- END disabled -->
						<!-- ELSE -->
						<tr>
							<td colspan="6">
								<div class="alert alert-info text-center">
									You have no disabled categories.
								</div>
							</td>
						</tr>
						<!-- ENDIF disabled.length -->
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Categories Control Panel</div>
			<div class="panel-body">
				<button type="button" class="btn btn-primary btn-block" data-action="create">Create New Category</button>
			</div>
		</div>
	</div>
</div>
