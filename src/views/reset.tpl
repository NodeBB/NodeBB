<div class="flex-fill row justify-content-center">
	<div class="col-12 col-md-5 col-lg-4 px-md-0">
		<div class="alert alert-info">
			{{tx("reset_password:enter-username-or-email")}}
		</div>

		<div class="card card-body bg-light">
			<div class="alert alert-success alert-dismissible hide" id="success">
				<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
				{{tx("reset_password:password-reset-identifier-sent")}}
			</div>
			<div class="alert alert-danger alert-dismissible hide" id="error">
				<button type="button" class="btn-close" data-bs-dismiss="alert"></button>
				{{tx("reset_password:invalid-username-or-email")}}
			</div>
			<form onsubmit="return false;">
				<div class="mb-3">
					<input type="text" class="form-control" id="email" placeholder="{{tx("reset_password:enter-username-or-email-address")}}" autocomplete="username">
				</div>
				<div class="d-grid">
					<button class="btn btn-primary" id="reset" type="submit">{{tx("reset_password:reset-password")}}</button>
				</div>
			</form>
		</div>
	</div>
</div>
