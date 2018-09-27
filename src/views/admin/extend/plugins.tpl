<ul class="nav nav-pills">
	<li class="active"><a href="#installed" data-toggle="tab">
		[[admin/extend/plugins:installed]]
		<span class="badge">{installedCount}</span>
	</a></li>
	<li><a href="#active" data-toggle="tab">
		[[admin/extend/plugins:active]]
		<span class="badge">{activeCount}</span>
	</a></li>
	<li><a href="#deactive" data-toggle="tab">
		[[admin/extend/plugins:inactive]]
		<span class="badge">{inactiveCount}</span>
	</a></li>
	<li><a href="#upgrade" data-toggle="tab">
		[[admin/extend/plugins:out-of-date]]
		<span class="badge">{upgradeCount}</span>
	</a></li>
	<li><a href="#download" data-toggle="tab">[[admin/extend/plugins:find-plugins]]</a></li>
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
			<div class="tab-pane fade" id="deactive">
				<ul class="deactive"></ul>
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
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/extend/plugins:plugin-search]]</div>
			<div class="panel-body">
				<input autofocus class="form-control" type="text" id="plugin-search" placeholder="[[admin/extend/plugins:plugin-search-placeholder]]"/><br/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin/extend/plugins:reorder-plugins]]</div>
			<div class="panel-body">
				<button class="btn btn-default btn-block" id="plugin-order"><i class="fa fa-exchange"></i> [[admin/extend/plugins:order-active]]</button>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin/extend/plugins:dev-interested]]</div>
			<div class="panel-body">
				<p>
					[[admin/extend/plugins:docs-info]]
				</p>
			</div>
		</div>
	</div>


	<div class="modal fade" id="order-active-plugins-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">[[admin/extend/plugins:order-active]]</h4>
				</div>
				<div class="modal-body">
					<p>
						[[admin/extend/plugins:order.description]]
					</p>
					<p>
						[[admin/extend/plugins:order.explanation]]
					</p>
					<ul class="plugin-list"></ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">[[global:buttons.close]]</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">[[global:save]]</button>
				</div>
			</div>
		</div>
	</div>


</div>


