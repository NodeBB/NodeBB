<div class="row" id="navigation">
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
						<div class="col-sm-1">
							<div class="form-group">
								<label>[[admin/general/navigation:icon]]</label>
								<br/>
								<span class="iconPicker"><i class="fa fa-2x {enabled.iconClass}"></i>
									<a class="change-icon-link <!-- IF enabled.iconClass -->hidden<!-- ENDIF enabled.iconClass -->" href="#">[[admin/general/navigation:change-icon]]</a>
									<input class="form-control" type="hidden" name="iconClass" value="{enabled.iconClass}" />
								</span>
							</div>
						</div>

						<div class="col-sm-3">
							<div class="form-group">
								<label>[[admin/general/navigation:route]]</label>
								<input class="form-control" type="text" name="route" value="{enabled.route}" />
							</div>
						</div>

						<div class="col-sm-4">
							<div class="form-group">
								<label>[[admin/general/navigation:class]]</label>
								<input class="form-control" type="text" name="class" value="{enabled.class}" />
							</div>
						</div>

						<div class="col-sm-4">
							<div class="form-group">
								<label>[[admin/general/navigation:id]]</label>
								<input class="form-control" type="text" name="id" value="{enabled.id}" />
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-sm-4">
							<div class="form-group">
								<label>[[admin/general/navigation:text]]</label>
								<input class="form-control unescape" type="text" name="text" value="{enabled.text}" />
							</div>
						</div>
						<div class="col-sm-4">
							<div class="form-group">
								<label>[[admin/general/navigation:text-class]]</label>
								<input class="form-control" type="text" name="textClass" value="{enabled.textClass}" />
							</div>
						</div>

						<div class="col-sm-4">
							<div class="form-group">
								<label>[[admin/general/navigation:tooltip]]</label>
								<input class="form-control unescape" type="text" name="title" value="{enabled.title}" />
							</div>
						</div>
					</div>

					<strong>[[admin/general/navigation:groups]]</strong>
					<div>
						<select name="groups" class="form-control" size="10" multiple>
							<!-- BEGIN enabled.groups -->
							<option value="{enabled.groups.displayName}"<!-- IF enabled.groups.selected --> selected<!-- ENDIF enabled.groups.selected -->>{enabled.groups.displayName}</option>
							<!-- END enabled.groups -->
						</select>
					</div>

					<div class="checkbox">
						<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
							<input class="mdl-switch__input" type="checkbox" name="property:targetBlank" <!-- IF enabled.properties.targetBlank -->checked<!-- ENDIF enabled.properties.targetBlank -->/>
							<span class="mdl-switch__label"><strong>[[admin/general/navigation:open-new-window]]</strong></span>
						</label>
					</div>

					<button class="btn btn-danger delete">[[admin/general/navigation:btn.delete]]</button>
					<!-- IF enabled.enabled -->
					<button class="btn btn-warning toggle">[[admin/general/navigation:btn.disable]]</button>
					<!-- ELSE -->
					<button class="btn btn-success toggle">[[admin/general/navigation:btn.enable]]</button>
					<!-- ENDIF enabled.enabled -->
					<input type="hidden" name="enabled" value="{enabled.enabled}" />
				</form>
			</li>
			<!-- END enabled -->
		</ul>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/general/navigation:available-menu-items]]</div>
			<div class="panel-body">
				<ul id="available">
					<li data-id="custom" class="clearfix">
						<div data-id="custom" class="drag-item alert alert-success pull-left">
							<i class="fa fa-fw fa-plus-circle"></i>
						</div>
						<p>
							<strong>[[admin/general/navigation:custom-route]]</strong>
						</p>
					</li>
					<!-- BEGIN available -->
					<li data-id="@index" class="clearfix">
						<div data-id="@index" class="drag-item alert <!-- IF available.core -->alert-warning<!-- ELSE -->alert-info<!-- ENDIF available.core --> pull-left">
							<i class="fa fa-fw <!-- IF available.iconClass -->{available.iconClass}<!-- ELSE -->fa-navicon<!-- ENDIF available.iconClass -->"></i>
						</div>
						<p>
							<strong>{available.text}</strong> {available.route} <br/>
							<!-- IF available.core --> [[admin/general/navigation:core]] <!-- ELSE --> [[admin/general/navigation:plugin]] <!-- ENDIF available.core -->
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