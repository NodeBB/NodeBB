<div class="row">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-folder"></i> Categories</div>
			<div class="panel-body">
				<div class="row">
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
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Categories Control Panel</div>
			<div class="panel-body">
				<button class="btn btn-primary" id="addNew">Create New Category</button>
				<button class="btn btn-default" id="revertChanges">Revert Changes</button>
			</div>
		</div>
	</div>

	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-folder"></i> Categories</div>
			<div class="panel-body">
				<div class="row">
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
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
	
	<!-- IMPORT admin/partials/categories/new.tpl -->
	<!-- IMPORT admin/partials/categories/permissions.tpl -->
	<!-- IMPORT admin/partials/categories/setParent.tpl -->
	<div id="icons" style="display:none;">
		<div class="icon-container">
			<div class="row fa-icons">
				<i class="fa fa-doesnt-exist"></i>
				<!-- IMPORT admin/partials/fontawesome.tpl -->
			</div>
		</div>
	</div>
</div>