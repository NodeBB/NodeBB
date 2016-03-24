<div id="navigation">
	<div class="col-lg-9">
		<div class="clearfix">
			<ul id="active-navigation" class="nav navbar-nav">
				<!-- BEGIN navigation -->
				<li data-index="{navigation.index}" class="{navigation.class} <!-- IF navigation.selected --> active <!-- ENDIF navigation.selected -->">
					<a href="#" title="{navigation.route}" id="{navigation.id}">
						<i class="fa fa-fw <!-- IF navigation.iconClass -->{navigation.iconClass}<!-- ENDIF navigation.iconClass -->"></i>
					</a>
				</li>
				<!-- END navigation -->
			</ul>
		</div>

		<hr/>

		<ul id="enabled">
			<!-- BEGIN enabled -->
			<li data-index="{enabled.index}" class="well <!-- IF !enabled.selected -->hidden<!-- ENDIF !enabled.selected -->">
				<form>
					<div class="row">
						<div class="col-sm-6">

							<div class="form-group">
								<label>Icon:</label>
								<br/>
								<span class="iconPicker"><i class="fa fa-2x {enabled.iconClass}"></i>
									<a class="change-icon-link <!-- IF enabled.iconClass -->hidden<!-- ENDIF enabled.iconClass -->" href="#">change</a>
									<input class="form-control" type="hidden" name="iconClass" value="{enabled.iconClass}" />
								</span>
							</div>

							<div class="form-group">
								<label>Route:</label>
								<input class="form-control" type="text" name="route" value="{enabled.route}" />
							</div>

							<div class="form-group">
								<label>Tooltip:</label>
								<input class="form-control unescape" type="text" name="title" value="{enabled.title}" />
							</div>
						</div>

						<div class="col-sm-6">
							<div class="form-group">
								<label>Text:</label>
								<input class="form-control unescape" type="text" name="text" value="{enabled.text}" />
							</div>

							<div class="form-group">
								<label>Text Class: <small>optional</small></label>
								<input class="form-control" type="text" name="textClass" value="{enabled.textClass}" />
							</div>

							<div class="form-group">
								<label>ID: <small>optional</small></label>
								<input class="form-control" type="text" name="id" value="{enabled.id}" />
							</div>
						</div>
					</div>

					<strong>Properties:</strong>
					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:adminOnly" <!-- IF enabled.properties.adminOnly -->checked<!-- ENDIF enabled.properties.adminOnly -->/>
							<span class="mdl-switch__label"><strong>Only display to Admins</strong></span>
						</label>
					</div>
					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:globalMod" <!-- IF enabled.properties.globalMod -->checked<!-- ENDIF enabled.properties.globalMod -->/>
							<span class="mdl-switch__label"><strong>Only display to Global Moderators and Admins</strong></span>
						</label>
					</div>
					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:loggedIn" <!-- IF enabled.properties.loggedIn -->checked<!-- ENDIF enabled.properties.loggedIn -->/> <span class="mdl-switch__label"><strong>Only display to logged in users</strong></span>
						</label>
					</div>
					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:targetBlank" <!-- IF enabled.properties.targetBlank -->checked<!-- ENDIF enabled.properties.targetBlank -->/>
							<span class="mdl-switch__label"><strong>Open in a new window</strong></span>
						</label>
					</div>

					<strong>Installed Plugins Required:</strong>

					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:searchInstalled" <!-- IF enabled.properties.searchInstalled -->checked<!-- ENDIF enabled.properties.searchInstalled -->/>
							<span class="mdl-switch__label"><strong>Search plugin</strong></span>
						</label>
					</div>

					<button class="btn btn-danger delete">Delete</button>
					<!-- IF enabled.enabled -->
					<button class="btn btn-warning toggle">Disable</button>
					<!-- ELSE -->
					<button class="btn btn-success toggle">Enable</button>
					<!-- ENDIF enabled.enabled -->
					<input type="hidden" name="enabled" value="{enabled.enabled}" />
				</form>
			</li>
			<!-- END enabled -->
		</ul>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Available Menu Items</div>
			<div class="panel-body">
				<ul id="available">
					<li data-id="custom" class="clearfix">
						<div data-id="custom" class="drag-item alert alert-success pull-left">
							<i class="fa fa-fw fa-plus-circle"></i>
						</div>
						<p>
							<strong>Custom Route</strong>
						</p>
					</li>
					<!-- BEGIN available -->
					<li data-id="@index" class="clearfix">
						<div data-id="@index" class="drag-item alert <!-- IF available.core -->alert-warning<!-- ELSE -->alert-info<!-- ENDIF available.core --> pull-left">
							<i class="fa fa-fw <!-- IF available.iconClass -->{available.iconClass}<!-- ELSE -->fa-navicon<!-- ENDIF available.iconClass -->"></i>
						</div>
						<p>
							<strong>{available.text}</strong> {available.route} <br/>
							<!-- IF available.core --> core <!-- ELSE --> plugin <!-- ENDIF available.core -->
						</p>
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