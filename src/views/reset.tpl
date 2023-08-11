<!-- IMPORT partials/breadcrumbs.tpl -->
<div class="flex-fill">
	<div class="alert alert-info">
		[[reset_password:enter_email]]
	</div>

	<div class="card card-body bg-light">
		<div class="alert alert-success alert-dismissible hide" id="success">
			<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
			[[reset_password:password_reset_sent]]
		</div>
		<div class="alert alert-danger alert-dismissible hide" id="error">
			<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
			[[reset_password:invalid_email]]
		</div>
		<form onsubmit="return false;">
			<div class="mb-3">
				<input type="email" class="form-control form-control-lg" id="email" placeholder="[[reset_password:enter_email_address]]" autocomplete="off">
			</div>
			<div class="d-grid">
				<button class="btn btn-primary btn-lg" id="reset" type="submit">[[reset_password:reset_password]]</button>
			</div>
		</form>
	</div>
</div>