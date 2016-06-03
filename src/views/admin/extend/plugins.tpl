<ul class="nav nav-pills">
	<li class="active"><a href="#installed" data-toggle="tab">Installed Plugins</a></li>
	<li><a href="#active" data-toggle="tab">Active Plugins</a></li>
	<li><a href="#download" data-toggle="tab">Download Plugins</a></li>
	<li><a href="#upgrade" data-toggle="tab">Upgradable Plugins</a></li>
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
			<div class="tab-pane fade" id="download">
				<ul class="download">
					<!-- BEGIN download -->
					<!-- IMPORT admin/partials/download_plugin_item.tpl -->
					<!-- END download -->
				</ul>
			</div>
			<div class="tab-pane fade" id="upgrade">
				<ul class="upgrade"></ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Plugin Search</div>
			<div class="panel-body">
				<input autofocus class="form-control" type="text" id="plugin-search" placeholder="Search for plugin..."/><br/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Re-order Plugins</div>
			<div class="panel-body">
				<button class="btn btn-default btn-block" id="plugin-order"><i class="fa fa-exchange"></i> Order Active Plugins</button>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Interested in writing plugins for NodeBB?</div>
			<div class="panel-body">
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
					<button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">Save</button>
				</div>
			</div>
		</div>
	</div>


</div>


