<form class="form">
	<div class="row">
		<div class="col-4">
			<div class="mb-3">
				<label for="length">[[admin/manage/users:temp-ban.length]]</label>
				<input class="form-control" id="length" name="length" type="number" min="0" value="1" />
			</div>
		</div>
		<div class="col-8">
			<div class="mb-3">
				<label for="reason">[[admin/manage/users:temp-ban.reason]]</label>
				<input type="text" class="form-control" id="reason" name="reason" />
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-4 text-center">
			<div class="mb-3 units">
				<label>[[admin/manage/users:temp-ban.hours]]</label>
				<input type="radio" name="unit" value="0" checked />
				&nbsp;&nbsp;
				<label>[[admin/manage/users:temp-ban.days]]</label>
				<input type="radio" name="unit" value="1" />
			</div>
		</div>
		<div class="col-sm-8">
			<p class="form-text">
				[[admin/manage/users:temp-ban.explanation]]
			</p>
		</div>
	</div>
</form>
