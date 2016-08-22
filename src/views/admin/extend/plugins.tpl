<ul class="nav nav-pills">
	<li class="nav-item"><a class="nav-link active" href="#installed" data-toggle="tab">Installed</a></li>
	<li class="nav-item"><a class="nav-link" href="#active" data-toggle="tab">Active</a></li>
	<li class="nav-item"><a class="nav-link" href="#upgrade" data-toggle="tab">
		Out of Date
		<span class="badge">{upgradeCount}</span>
	</a></li>
	<li class="nav-item"><a class="nav-link" href="#download" data-toggle="tab">Find Plugins</a></li>
</ul>
<br />

<div class="plugins row">
	<div class="col-lg-9">
		<div class="tab-content">
			<div class="tab-pane fade active in" id="installed">
				<ul class="installed">
					<!-- BEGIN installed -->
					<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
					<!-- END installed -->
				</ul>
			</div>
			<div class="tab-pane fade" id="active">
				<ul class="active"></ul>
			</div>
			<div class="tab-pane fade" id="upgrade">
				<ul class="upgrade"></ul>
			</div>
			<div class="tab-pane fade" id="download">
				<ul class="download">
					<!-- BEGIN download -->
					<!-- IMPORT admin/partials/download_plugin_item.tpl -->
					<!-- END download -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="card">
			<div class="card-header">Plugin Search</div>
			<div class="card-block">
				<input autofocus class="form-control" type="text" id="plugin-search" placeholder="Search for plugin..."/><br/>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Re-order Plugins</div>
			<div class="card-block">
				<button class="btn btn-secondary btn-block" id="plugin-order"><i class="fa fa-exchange"></i> Order Active Plugins</button>
			</div>
		</div>

		<div class="card">
			<div class="card-header">Interested in writing plugins for NodeBB?</div>
			<div class="card-block">
				<p>
					Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://docs.nodebb.org/en/latest/plugins/create.html">NodeBB Docs Portal</a>.
				</p>
			</div>
		</div>
	</div>


	<div class="modal fade" id="order-active-plugins-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">Order Active Plugins</h4>
				</div>
				<div class="modal-body">
					<p>
						Certain plugins work ideally when they are initialised before/after other plugins.
					</p>
					<p>
						Plugins load in the order specified here, from top to bottom
					</p>
					<ul class="plugin-list"></ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">Save</button>
				</div>
			</div>
		</div>
	</div>


</div>


