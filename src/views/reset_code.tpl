<div class="row col-12 col-sm-6 offset-sm-3">
	{{{ if valid }}}
	<div class="card card-body bg-light">
		{{{ if displayExpiryNotice }}}
		<div class="alert alert-warning">
			[[reset_password:password-expired]]
		</div>
		{{{ end }}}
		<div class="alert alert-success alert-dismissible hidden" id="success">
			<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
			<strong>[[reset_password:password-changed.title]]</strong>
			<p>[[reset_password:password-changed.message]]</p>
		</div>
		<div class="alert alert-warning hidden" id="notice">
			<strong></strong>
			<p></p>
		</div>
		<form onsubmit="return false;" id="reset-form">
			<div class="mb-3">
				<label class="form-label" for="password">[[reset_password:new-password]]</label>
				<input class="form-control" type="password" placeholder="[[reset_password:new-password]]" id="password" /><br />
			</div>
			<div class="mb-3">
				<label class="form-label" for="repeat">[[reset_password:repeat-password]]</label>
				<input class="form-control" type="password" placeholder="[[reset_password:repeat-password]]" id="repeat" /><br />
			</div>
			<button class="btn btn-primary btn-block" id="reset" type="submit">[[reset_password:reset-password]]</button>
		</form>
	</div>
	{{{ else }}}
	<div class="card text-bg-danger">
		<h5 class="card-header">
			[[reset_password:wrong-reset-code.title]]
		</h5>
		<div class="card-body">
			<p>[[reset_password:wrong-reset-code.message]]</p>
		</div>
	</div>
	{{{ end }}}
</div>