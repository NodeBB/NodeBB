<div class="flex-fill">
	<div class="alert alert-info">
		[[reset_password:enter-email]]
	</div>

	<div class="card card-body bg-light">
		<div class="alert alert-success alert-dismissible hide" id="success">
			<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
			[[reset_password:password-reset-sent]]
		</div>
		<div class="alert alert-danger alert-dismissible hide" id="error">
			<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
			[[reset_password:invalid-email]]
		</div>
		<form onsubmit="return false;">
			<div class="mb-3">
				<input type="email" class="form-control form-control-lg" id="email" placeholder="[[reset_password:enter-email-address]]" autocomplete="off">
			</div>
			<div class="d-grid">
				<button class="btn btn-primary btn-lg" id="reset" type="submit">[[reset_password:reset-password]]</button>
			</div>
		</form>
	</div>
</div>