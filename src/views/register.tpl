<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="row register flex-fill">
	<div class="d-flex flex-column gap-2 {{{ if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<h2 class="tracking-tight fw-semibold text-center">{{tx("global:register")}}</h2>
		<div class="row justify-content-center gap-5">

			<div class="col-12 col-md-5 col-lg-3 px-md-0">
				<div class="register-block">
					<form component="register/local" class="d-flex flex-column gap-3" role="form" action="{config.relative_path}/register" method="post">
						<div class="mb-2 d-flex flex-column gap-2">
							<label for="username">{{tx("register:username")}}</label>
							<div class="d-flex flex-column">
								<input class="form-control" type="text" placeholder="{{tx("register:username-placeholder")}}" name="username" id="username" autocorrect="off" autocapitalize="off" autocomplete="nickname" aria-required="true" aria-describedby="username-notify"/>
								<span class="register-feedback text-xs text-danger" id="username-notify" aria-live="polite"></span>
								<span class="form-text text-xs">{{tx("register:help.username-restrictions", minimumUsernameLength, maximumUsernameLength)}}</span>
							</div>
						</div>

						<div class="mb-2 d-flex flex-column gap-2">
							<label for="password">{{tx("register:password")}}</label>
							<div class="d-flex flex-column">
								<input class="form-control" type="password" placeholder="{{tx("register:password-placeholder")}}" name="password" id="password" autocomplete="new-password" autocapitalize="off" aria-required="true" aria-describedby="password-notify"/>
								<span class="register-feedback text-xs text-danger" id="password-notify" aria-live="polite"></span>
								<span class="form-text text-xs">{{tx("register:help.minimum-password-length", minimumPasswordLength)}}</span>
								<p id="caps-lock-warning" class="text-danger hidden">
									<i class="fa fa-exclamation-triangle"></i> {{tx("login:caps-lock-enabled")}}
								</p>
							</div>
						</div>

						<div class="mb-2 d-flex flex-column gap-2">
							<label for="password-confirm">{{tx("register:confirm-password")}}</label>
							<div>
								<input class="form-control" type="password" placeholder="{{tx("register:confirm-password-placeholder")}}" name="password-confirm" id="password-confirm" autocomplete="new-password" autocapitalize="off" aria-required="true" aria-describedby="password-confirm-notify"/>
								<span class="register-feedback text-xs text-danger" id="password-confirm-notify" aria-live="polite"></span>
							</div>
						</div>

						{{{ each regFormEntry }}}
						<div class="mb-2 regFormEntry d-flex flex-column gap-2 {./styleName}">
							<label for="{./inputId}">{{tx(./label)}}</label>
							<div>{{./html}}</div>
						</div>
						{{{ end }}}

						<button class="btn btn-primary" id="register" type="submit">{{tx("register:register-now-button")}}</button>

						<div class="alert alert-danger{{{ if !error }}} hidden{{{ end }}}" id="register-error-notify" role="alert" aria-atomic="true">
							<strong>{{tx("error:registration-error")}}</strong>
							<p class="mb-0">{{tx(error)}}</p>
						</div>

						<hr/>

						<span class="text-sm">{{tx("register:already-have-account")}}</span>
						<a class="btn btn-outline-light text-body" href="{config.relative_path}/login">{{tx("global:login")}}</a>

						{{{ if osw_logins }}}
						<button class="btn btn-outline-light text-body" id="ap-register-handle-btn" type="button">
							<i class="fa fa-share-alt"></i> {{tx("login:manage-social-web-handles")}}
						</button>
						{{{ end }}}

						<input id="token" type="hidden" name="token" value="" />
						<input id="noscript" type="hidden" name="noscript" value="true" />
						<input type="hidden" name="_csrf" value="{config.csrf_token}" />
						{{{ if (config.userLang != config.defaultLang) }}}
						<input type="hidden" name="userLang" value="{config.userLang}" />
						{{{ end }}}
					</form>
				</div>
			</div>

			{{{ if alternate_logins }}}
			<div class="col-12 col-md-5 col-lg-3 px-md-0">
				<div class="alt-register-block d-flex flex-column gap-2">
					<label>{{tx("register:alternative-registration")}}</label>
					<ul class="alt-logins list-unstyled">
						{{{ each authentication }}}
						<li class="{./name} mb-2">
							<a class="btn btn-outline-light d-flex align-items-center" rel="nofollow noopener noreferrer" target="_top" href="{config.relative_path}{./url}">
								{{{ if ./icons.svg }}}
								{{./icons.svg}}
								{{{ else }}}
								<i class="flex-shrink-0 {./icons.normal}" style="color:{./color};"></i>
								{{{ end }}}
								{{{ if ./labels.register }}}
								<div class="flex-grow-1 text-body text-sm">{{tx(./labels.register)}}</div>
								{{{ end }}}
							</a>
						</li>
						{{{ end }}}
					</ul>
				</div>
			</div>
			{{{ end }}}
		</div>
	</div>
	<div data-widget-area="sidebar" class="col-lg-3 col-sm-12 {{{ if !widgets.sidebar.length }}}hidden{{{ end }}}">
		{{{each widgets.sidebar}}}
		{{widgets.sidebar.html}}
		{{{end}}}
	</div>
</div>
<div data-widget-area="footer">
	{{{each widgets.footer}}}
	{{widgets.footer.html}}
	{{{end}}}
</div>