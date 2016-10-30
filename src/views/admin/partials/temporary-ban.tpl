<form class="form">
	<div class="row">
		<div class="col-xs-4">
			<div class="form-group">
				<label for="length">Ban Length</label>
				<input class="form-control" id="length" name="length" type="number" min="0" value="1" />
			</div>
		</div>
		<div class="col-xs-8">
			<div class="form-group">
				<label for="reason">Reason <span class="text-muted">(Optional)</span></label>
				<input type="text" class="form-control" id="reason" name="reason" />
			</div>
		</div>
	</div>
	<div class="row">
		<div class="col-sm-4 text-center">
			<div class="form-group units">
				<label>Hours</label>
				<input type="radio" name="unit" value="0" checked />
				&nbsp;&nbsp;
				<label>Days</label>
				<input type="radio" name="unit" value="1" />
			</div>
		</div>
		<div class="col-sm-8">
			<p class="help-block">
				Enter the length of time for the ban. Note that a time of 0 will be a considered a permanent ban.
			</p>
		</div>
	</div>
</form>
