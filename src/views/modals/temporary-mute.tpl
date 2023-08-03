<form class="form">
	<div class="row">
		<div class="col-5">
			<div class="mb-3">
				<label class="form-label" for="length">[[admin/manage/users:temp-ban.length]]</label>
				<input class="form-control" id="length" name="length" type="number" min="0" value="1" />
			</div>
			<div class="form-check form-check-inline">
				<label class="form-check-label" for="unit-hours">[[admin/manage/users:temp-ban.hours]]</label>
				<input class="form-check-input" type="radio" id="unit-hours" name="unit" value="0" checked />
			</div>
			<div class="form-check form-check-inline">
				<label class="form-check-label" for="unit-days">[[admin/manage/users:temp-ban.days]]</label>
				<input class="form-check-input" type="radio" id="unit-days" name="unit" value="1" />
			</div>
		</div>
		<div class="col-7">
			<div class="">
				<label class="form-label" for="reason">[[admin/manage/users:temp-ban.reason]]</label>
				<input type="text" class="form-control" id="reason" name="reason" />
			</div>
		</div>
	</div>
</form>
