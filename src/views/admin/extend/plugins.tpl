<ul class="nav nav-pills">
	<li class="active"><a href="#installed" data-toggle="tab">[[admin:plugins.installed_plugins]]</a></li>
	<li><a href="#download" data-toggle="tab">[[admin:plugins.download_plugins]]</a></li>
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
			<div class="tab-pane fade" id="download">
				<div class="panel-body">
					<ul class="download">
						<!-- BEGIN download -->
						<!-- IMPORT admin/partials/download_plugin_item.tpl -->
						<!-- END download -->
					</ul>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:plugins.plugin_search]]</div>
			<div class="panel-body">
				<input class="form-control" type="text" id="plugin-search" placeholder="[[admin:plugins.plugin_search_placeholder]]"/><br/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:plugins.re_order_plugins]]</div>
			<div class="panel-body">
				<button class="btn btn-default btn-block" id="plugin-order"><i class="fa fa-exchange"></i>[[admin:plugins.order_active_plugins]]</button>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[admin:plugins.interested_in_writing_plugins_for_nodebb]]</div>
			<div class="panel-body">
				<p>[[admin:plugins.help]]
				</p>
			</div>
		</div>
	</div>


	<div class="modal fade" id="order-active-plugins-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">[[admin:plugins.order_active_plugins]]</h4>
				</div>
				<div class="modal-body">
					<p>
						[[admin:plugins.order_active_plugins_line1]]
					</p>
					<p>
						[[admin:plugins.order_active_plugins_line2]]
					</p>
					<ul class="plugin-list"></ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal">[[admin:plugins.close]]</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">[[admin:plugins.save]]</button>
				</div>
			</div>
		</div>
	</div>


</div>