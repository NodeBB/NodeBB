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
				<!-- IMPORT partials/custom-reason.tpl -->
			</div>
		</div>
	</div>
</form>
