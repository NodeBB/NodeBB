
<div id="rewards" class="px-lg-4">
	<ul id="active">
		{{{ each active }}}
		<li data-rid="{active.rid}" data-id="{active.id}">
			<div class="row">
				<div class="col-12 col-lg-8">
					<form class="main d-inline-block">
						<div class="card card-body d-inline-block if-block">
							<label class="form-label" for="condition-if-users">[[admin/extend/rewards:condition-if-users]]</label>
							<select id="condition-if-users" class="form-select" name="condition" data-selected="{active.condition}">
								{{{ each conditions }}}
								<option value="{conditions.condition}">{conditions.name}</option>
								{{{ end }}}
							</select>
						</div>
						<div class="card card-body d-inline-block this-block">
							<label class="form-label" for="condition-is">[[admin/extend/rewards:condition-is]]</label>
							<div class="row">
								<div class="col-4">
									<select id="condition-is" class="form-select" name="conditional" data-selected="{active.conditional}">
										{{{ each  conditionals }}}
										<option value="{conditionals.conditional}">{conditionals.name}</option>
										{{{ end }}}
									</select>
								</div>
								<div class="col-8">
									<input class="form-control" type="text" name="value" value="{active.value}" />
								</div>
							</div>
						</div>
						<div class="card card-body d-inline-block then-block">
							<label class="form-label" for="condition-then">[[admin/extend/rewards:condition-then]]</label>
							<select id="condition-then" class="form-select" name="rid" data-selected="{active.rid}">
								{{{ each ../../rewards }}}
								<option value="{rewards.rid}">{rewards.name}</option>
								{{{ end }}}
							</select>
						</div>
					</form>
				</div>
				<div class="col-12 col-lg-4">
					<form class="rewards d-inline-block">
						<div class="inputs card card-body d-inline-block reward-block"></div>
					</form>
				</div>
			</div>

			<div class="float-start">
				<div class="card-body d-inline-block">
					<form class="main">
						<label class="form-label" for="claimable">[[admin/extend/rewards:max-claims]] <small>[[admin/extend/rewards:zero-infinite]]</small></label>
						<input id="claimable" class="form-control" type="text" name="claimable" value="{active.claimable}" placeholder="1" />
					</form>
				</div>
			</div>

			<div class="float-end">
				<div class="card-body d-inline-block">
					<button class="btn btn-danger delete">[[admin/extend/rewards:delete]]</button>
					{{{ if active.disabled }}}
					<button class="btn btn-success toggle">[[admin/extend/rewards:enable]]</button>
					{{{ else }}}
					<button class="btn btn-warning toggle">[[admin/extend/rewards:disable]]</button>
					{{{ end }}}
				</div>
			</div>
			<div class="clearfix"></div>
		</li>
		{{{ end }}}
	</ul>
</div>

<div class="floating-button">
	<button id="new" class="btn btn-primary position-fixed end-0 px-3 py-2 mb-4 me-4 rounded-circle fs-4" type="button" style="width: 64px; height: 64px;">
		<i class="fa fa-fw fa-plus"></i>
	</button>

	<!-- IMPORT admin/partials/save_button.tpl -->
</div>