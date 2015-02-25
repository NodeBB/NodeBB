<div id="navigation">
	<div class="col-lg-6">
		<div class="panel panel-default">
			<div class="panel-heading">Active Navigation</div>
			<div class="panel-body">
				<ul id="enabled">
					<!-- BEGIN enabled -->
					<li class="well">
						<form>
							<label>ID: <small>optional</small>
								<input class="form-control" type="text" name="id" value="{enabled.id}" />
							</label>
							<label>Route: <small>ex. /unread</small>
								<input class="form-control" type="text" name="route" value="{enabled.route}" />
							</label>
							<label>Title: <small>text shown upon mouseover</small>
								<input class="form-control" type="text" name="title" value="{enabled.title}" />
							</label>
							<label>Text:
								<input class="form-control" type="text" name="textClass" value="{enabled.text}" />
							</label>
							<label>Icon Class: <small><a href="http://fortawesome.github.io/Font-Awesome/cheatsheet/" target="_blank">pick one</a></small>
								<input class="form-control" type="text" name="iconClass" value="{enabled.iconClass}" />
							</label>
							<label>Text Class: <small>optional</small>
								<input class="form-control" type="text" name="textClass" value="{enabled.textClass}" />
							</label>
							<hr />
							<button class="btn btn-danger delete">Delete</button>
							<label>Enabled
								<input type="checkbox" name="enabled" <!-- IF enabled --> checked<!-- ENDIF enabled --> />
							</label>
						</form>
					</li>
					<!-- END enabled -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Available Menu Items</div>
			<div class="panel-body">
				<ul id="active">
					<li data-id="Custom" class="alert alert-warning">
						<strong>Custom Route</strong>
					</li>
					<!-- BEGIN available -->
					<li data-id="@index" class="alert <!-- IF available.core -->alert-info<!-- ELSE -->alert-success<!-- ENDIF available.core -->">
						<strong>{available.title}</strong> {available.route}
						<span class="pull-right badge"><!-- IF available.core -->core<!-- ELSE -->plugin<!-- ENDIF available.core --></span>
					</li>
					<!-- END available -->
					<input type="hidden" template-variable="available" value="{function.stringify, available}" />
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">Navigation Control</div>
			<div class="panel-body">
				<button class="btn btn-primary btn-md" id="save">Save Changes</button>
			</div>
		</div>
	</div>
</div>