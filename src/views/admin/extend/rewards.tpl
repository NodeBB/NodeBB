
<div id="rewards">
	<ul id="active">
		{{{ each active }}}
		<li data-rid="{active.rid}" data-id="{active.id}">
			<div class="row">
				<div class="col-xs-12 col-sm-12 col-lg-8">
					<form class="main inline-block">
						<div class="well inline-block if-block">
							<label for="condition-if-users">[[admin/extend/rewards:condition-if-users]]</label><br />
							<select id="condition-if-users" class="form-control" name="condition" data-selected="{active.condition}">
								{{{ each conditions }}}
								<option value="{conditions.condition}">{conditions.name}</option>
								{{{ end }}}
							</select>
						</div>
						<div class="well inline-block this-block">
							<label for="condition-is">[[admin/extend/rewards:condition-is]]</label><br />
							<div class="row">
								<div class="col-xs-6">
									<select id="condition-is" class="form-control" name="conditional" data-selected="{active.conditional}">
										{{{ each  conditionals }}}
										<option value="{conditionals.conditional}">{conditionals.name}</option>
										{{{ end }}}
									</select>
								</div>
								<div class="col-xs-6">
									<input class="form-control" type="text" name="value" value="{active.value}" />
								</div>
							</div>
						</div>
						<div class="well inline-block then-block">
							<label for="condition-then">[[admin/extend/rewards:condition-then]]</label><br />
							<select id="condition-then" class="form-control" name="rid" data-selected="{active.rid}">
								<!-- BEGIN ../../rewards -->
								<option value="{rewards.rid}">{rewards.name}</option>
								<!-- END ../../rewards -->
							</select>
						</div>
					</form>
				</div>
				<div class="col-xs-12 col-sm-12 col-lg-4">
					<form class="rewards inline-block">
						<div class="inputs well inline-block reward-block"></div>
					</form>
				</div>
			</div>

			<div class="pull-left">
				<div class="panel-body inline-block">
					<form class="main">
						<label for="claimable">[[admin/extend/rewards:max-claims]] <small>[[admin/extend/rewards:zero-infinite]]</small></label><br />
						<input id="claimable" class="form-control" type="text" name="claimable" value="{active.claimable}" placeholder="1" />
					</form>
				</div>
			</div>

			<div class="pull-right">
				<div class="panel-body inline-block">
					<button class="btn btn-danger delete">[[admin/extend/rewards:delete]]</button>
					<!-- IF active.disabled -->
					<button class="btn btn-success toggle">[[admin/extend/rewards:enable]]</button>
					<!-- ELSE -->
					<button class="btn btn-warning toggle">[[admin/extend/rewards:disable]]</button>
					<!-- ENDIF active.disabled -->
				</div>
			</div>
			<div class="clearfix"></div>
		</li>
		{{{ end }}}
	</ul>
</div>

<div class="floating-button">
	<button id="new" class="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored" >
		<i class="material-icons">add</i>
	</button>

	<button id="save" class="mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored primary">
		<i class="material-icons">save</i>
	</button>
</div>