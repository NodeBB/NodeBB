<form class="form-inline">
	<div class="form-group text-center">
		<label for="days">Ban Length</label>
		<input class="form-control" name="length" type="number" min="1" value="1" /><br />
		<label>Hours</label>
		<input type="radio" name="unit" value="0" checked />
		<label>Days</label>
		<input type="radio" name="unit" value="1" />
	</div>
	<p class="help-block">
		Enter the length of time for the ban. Note that a time of 0 will be a considered a permanent ban.
	</p>
</form>