<div id="navigation">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:navigation.active_navigation]]</div>
			<div class="panel-body">
				<ul id="enabled">
					<!-- BEGIN enabled -->
					<li class="well">
						<form>
							<div class="row">
								<div class="col-sm-6">
									<label>[[admin:navigation.id]]<small>[[admin:navigation.optional]]</small>
										<input class="form-control" type="text" name="id" value="{enabled.id}" />
									</label>
									<label>[[admin:navigation.title]]<small>[[admin:navigation.shown_upon_mouseover]]</small>
										<input class="form-control" type="text" name="title" value="{enabled.title}" />
									</label>
									<label>[[admin:navigation.icon_class]]<small><a href="http://fortawesome.github.io/Font-Awesome/cheatsheet/" target="_blank">[[admin:navigation.pick_one]]</a></small>
										<input class="form-control" type="text" name="iconClass" value="{enabled.iconClass}" />
									</label>
								</div>
								<div class="col-sm-6">
									<label>[[admin:navigation.route]]<small>[[admin:navigation.route_ex]]</small>
										<input class="form-control" type="text" name="route" value="{enabled.route}" />
									</label>
									<label>[[admin:navigation.text]]<input class="form-control" type="text" name="text" value="{enabled.text}" />
									</label>
									<label>[[admin:navigation.text_class]]<small>[[admin:navigation.optional]]</small>
										<input class="form-control" type="text" name="textClass" value="{enabled.textClass}" />
									</label>
								</div>
							</div>

							<hr />

							<strong>[[admin:navigation.properties]]</strong>
							<div class="checkbox">
								<label>
									<input type="checkbox" name="property:adminOnly" <!-- IF enabled.properties.adminOnly -->[[admin:navigation.checked]]<!-- ENDIF enabled.properties.adminOnly -->/> <strong>[[admin:navigation.only_display_to_admins]]</strong>
								</label>
							</div>
							<div class="checkbox">
								<label>
									<input type="checkbox" name="property:loggedIn" <!-- IF enabled.properties.loggedIn -->[[admin:navigation.checked]]<!-- ENDIF enabled.properties.loggedIn -->/> <strong>[[admin:navigation.only_display_to_logged_in_users]]</strong>
								</label>
							</div>
							<div class="checkbox">
								<label>
									<input type="checkbox" name="property:targetBlank" <!-- IF enabled.properties.targetBlank -->[[admin:navigation.checked]]<!-- ENDIF enabled.properties.targetBlank -->/> <strong>[[admin:navigation.open_in_a_new_window]]</strong>
								</label>
							</div>


							<hr />
							<button class="btn btn-danger delete">[[admin:navigation.delete]]</button>
							<!-- IF enabled.enabled -->
							<button class="btn btn-warning toggle">[[admin:navigation.disable]]</button>
							<!-- ELSE -->
							<button class="btn btn-success toggle">[[admin:navigation.enable]]</button>
							<!-- ENDIF enabled.enabled -->
							<input type="hidden" name="enabled" value="{enabled.enabled}" />
						</form>
					</li>
					<!-- END enabled -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:navigation.available_menu_items]]</div>
			<div class="panel-body">
				<ul id="available">
					<li data-id="custom" class="alert alert-warning">
						<strong>[[admin:navigation.custom_route]]</strong>
					</li>
					<!-- BEGIN available -->
					<li data-id="@index" class="alert <!-- IF available.core -->alert_info<!-- ELSE -->alert_success<!-- ENDIF available.core -->">
						<strong>{available.text}</strong> {available.route}
						<span class="pull-right badge"><!-- IF available.core -->core<!-- ELSE -->plugin<!-- ENDIF available.core --></span>
					</li>
					<!-- END available -->
				</ul>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>