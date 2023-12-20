
<div class="tags d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/extend/rewards:rewards]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<button id="new" class="btn btn-light btn-sm text-nowrap" type="button">
				<i class="fa fa-fw fa-plus"></i> [[admin/extend/rewards:add-reward]]
			</button>
			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div id="rewards" class="">
		<ul id="active" class="list-unstyled p-0 m-0">
			{{{ each active }}}
			<li data-rid="{active.rid}" data-id="{active.id}">
				<div class="d-flex gap-1 align-items-start">
					<a href="#" component="sort/handle" class="btn btn-light btn-sm d-none d-md-block" style="cursor:grab;"><i class="fa fa-arrows-up-down text-muted"></i></a>
					<div class="d-flex flex-column flex-grow-1">
						<div class="d-flex gap-1 mb-3 flex-wrap">
							<form class="main d-flex gap-1 flex-wrap">
								<div class="card card-body m-0 if-block border-info border border-2">
									<label class="form-label" for="condition-if-users">[[admin/extend/rewards:condition-if-users]]</label>
									<select id="condition-if-users" class="form-select form-select-sm" name="condition" data-selected="{active.condition}">
										{{{ each conditions }}}
										<option value="{conditions.condition}">{conditions.name}</option>
										{{{ end }}}
									</select>
								</div>
								<div class="card card-body m-0 this-block border-warning border border-2">
									<label class="form-label" for="condition-is">[[admin/extend/rewards:condition-is]]</label>
									<div class="d-flex gap-1 flex-nowrap">
										<select id="condition-is" class="form-select form-select-sm" name="conditional" data-selected="{active.conditional}" style="max-width: 64px;">
											{{{ each  conditionals }}}
											<option value="{conditionals.conditional}">{conditionals.name}</option>
											{{{ end }}}
										</select>

										<input class="form-control form-control-sm" type="text" name="value" value="{active.value}" style="max-width: 128px;"/>
									</div>
								</div>
								<div class="card card-body m-0 then-block border-primary border border-2">
									<label class="form-label" for="condition-then">[[admin/extend/rewards:condition-then]]</label>
									<select id="condition-then" class="form-select form-select-sm" name="rid" data-selected="{active.rid}">
										{{{ each ../../rewards }}}
										<option value="{rewards.rid}">{rewards.name}</option>
										{{{ end }}}
									</select>
								</div>
							</form>
							<form class="rewards flex-1">
								<div class="inputs card card-body m-0 h-100 reward-block border-success border border-2"><div class="d-flex h-100 align-items-center">[[admin/extend/rewards:select-reward]]</div></div>
							</form>
						</div>

						<div class="d-flex justify-content-between align-items-center gap-2">
							<form class="main d-flex gap-1 align-items-start gap-2">
								<div class="d-flex flex-column gap-0">
									<label class="form-label" for="claimable">[[admin/extend/rewards:max-claims]]</label>
									<p class="form-text mb-0">
										[[admin/extend/rewards:zero-infinite]]
									</p>
								</div>
								<input id="claimable" class="form-control form-control-sm" type="text" name="claimable" value="{active.claimable}" placeholder="1" style="max-width: 64px;"/>

							</form>
							<div class="d-flex gap-1 align-self-start">
								<button class="btn btn-light btn-sm toggle text-nowrap disable {{{ if active.disabled }}}hidden{{{ end }}}"><i class="fa fa-ban text-danger"></i> [[admin/extend/rewards:disable]]</button>

								<button class="btn btn-light btn-sm toggle text-nowrap enable {{{ if !active.disabled }}}hidden{{{ end }}}"><i class="fa fa-check text-success"></i> [[admin/extend/rewards:enable]]</button>

								<button class="btn btn-light btn-sm text-nowrap delete"><i class="fa fa-trash text-danger"></i> [[admin/extend/rewards:delete]]</button>
							</div>
						</div>
					</div>
				</div>

				<hr/>
			</li>
			{{{ end }}}
		</ul>
	</div>
</div>