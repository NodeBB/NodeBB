<div class="card tool-modal shadow">
	<h5 class="card-header">[[topic:thread-tools.change-owner]]</h5>
	<div class="card-body">
		<p>
			[[topic:change-owner-instruction]]
		</p>
		<div class="mb-3">
			<label class="form-label" for="username"><strong>[[user:username]]</strong></label>
			<div class="input-group">
				<input id="username" type="text" class="form-control">
				<span class="input-group-text" type="button">
					<i class="fa fa-search"></i>
				</span>
			</div>
		</div>
		<p>
			<strong><span id="pids"></span></strong>
		</p>
	</div>
	<div class="card-footer text-end">
		<button class="btn btn-link btn-sm" id="change_owner_cancel">[[global:buttons.close]]</button>
		<button class="btn btn-primary btn-sm" id="change_owner_commit" disabled>[[topic:change-owner]]</button>
	</div>
</div>
