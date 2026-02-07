<form class="form">
	<div class="row">
		<div class="col-12">
			<div class="mb-3">
				<p class="form-text">
					[[admin/manage/users:temp-mute.explanation]]
				</p>
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-12">
			<div class="mb-3">
				<label class="form-label" for="length">[[admin/manage/users:temp-ban.length]]</label>
					<div class="d-flex gap-1">
					<input class="form-control" id="length" name="length" type="number" min="0" value="0" />
					<select class="form-select" id="unit" name="unit">
						<option value="0">[[admin/manage/users:temp-ban.hours]]</option>
						<option value="1">[[admin/manage/users:temp-ban.days]]</option>
					</select>
				</div>
			</div>
		</div>

		<div class="col-12">
			<div class="mb-3">
				<div class="d-flex align-items-center justify-content-between mb-2">
					<label class="form-label mb-0" for="reason">[[admin/manage/users:temp-ban.reason]]</label>
					{{{ if reasons.length }}}
					<div class="dropdown">
						<button class="btn btn-light btn-sm dropdown-toggle" type="button" id="reasonDropdown" data-bs-toggle="dropdown" aria-expanded="false">
							[[admin/manage/users:temp-ban.select-reason]]
							<span class="caret"></span>
						</button>
						<ul class="dropdown-menu dropdown-menu-end p-1" aria-labelledby="reasonDropdown">
							{{{ each reasons }}}
							<li><a class="dropdown-item rounded-1" href="#" data-key="{./key}">{./title}</a></li>
							{{{ end }}}
						</ul>
					</div>
					{{{ end }}}
				</div>

				<textarea rows="8" type="text" class="form-control" id="reason" name="reason"></textarea>
			</div>
		</div>
	</div>
</form>
