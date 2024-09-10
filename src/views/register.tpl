<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="row register flex-fill">
	<div class="d-flex flex-column gap-2 {{{ if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<h2 class="tracking-tight fw-semibold text-center">[[global:register]]</h2>
		<div class="row justify-content-center gap-5">

			<div class="col-12 col-md-5 col-lg-3 px-md-0">
				<div class="register-block">
					<form component="register/local" class="d-flex flex-column gap-3" role="form" action="{config.relative_path}/register" method="post">
						<div class="mb-2 d-flex flex-column gap-2">
							<label for="username">[[register:username]]</label>
							<div class="d-flex flex-column">
								<input class="form-control" type="text" placeholder="[[register:username-placeholder]]" name="username" id="username" autocorrect="off" autocapitalize="off" autocomplete="nickname" aria-required="true" aria-describedby="username-notify"/>
								<span class="register-feedback text-xs text-danger" id="username-notify" aria-live="polite"></span>
								<span class="form-text text-xs">[[register:help.username-restrictions, {minimumUsernameLength}, {maximumUsernameLength}]]</span>
							</div>
						</div>

						<div class="mb-2 d-flex flex-column gap-2">
							<label for="password">[[register:password]]</label>
							<div class="d-flex flex-column">
								<input class="form-control" type="password" placeholder="[[register:password-placeholder]]" name="password" id="password" autocomplete="new-password" autocapitalize="off" aria-required="true" aria-describedby="password-notify"/>
								<span class="register-feedback text-xs text-danger" id="password-notify" aria-live="polite"></span>
								<span class="form-text text-xs">[[register:help.minimum-password-length, {minimumPasswordLength}]]</span>
								<p id="caps-lock-warning" class="text-danger hidden">
									<i class="fa fa-exclamation-triangle"></i> [[login:caps-lock-enabled]]
								</p>
							</div>
						</div>

						<div class="mb-2 d-flex flex-column gap-2">
							<label for="password-confirm">[[register:confirm-password]]</label>
							<div>
								<input class="form-control" type="password" placeholder="[[register:confirm-password-placeholder]]" name="password-confirm" id="password-confirm" autocomplete="new-password" autocapitalize="off" aria-required="true" aria-describedby="password-confirm-notify"/>
								<span class="register-feedback text-xs text-danger" id="password-confirm-notify" aria-live="polite"></span>
							</div>
						</div>

						{{{ each regFormEntry }}}
						<div class="mb-2 regFormEntry d-flex flex-column gap-2 {./styleName}">
							<label for="{./inputId}">{./label}</label>
							<div>{{./html}}</div>
						</div>
						{{{ end }}}

						<button class="btn btn-primary" id="register" type="submit">[[register:register-now-button]]</button>

						<div class="alert alert-danger{{{ if !error }}} hidden{{{ end }}}" id="register-error-notify" role="alert" aria-atomic="true">
							<strong>[[error:registration-error]]</strong>
							<p class="mb-0">{error}</p>
						</div>

						<hr/>

						<span class="text-sm">[[register:already-have-account]]</span>
						<a class="btn btn-outline-light text-body" href="{config.relative_path}/login">[[global:login]]</a>

						<input id="token" type="hidden" name="token" value="" />
						<input id="noscript" type="hidden" name="noscript" value="true" />
						<input type="hidden" name="_csrf" value="{config.csrf_token}" />
					</form>
				</div>
			</div>

			{{{ if alternate_logins }}}
			<div class="col-12 col-md-5 col-lg-3 px-md-0">
				<div class="alt-register-block d-flex flex-column gap-2">
					<label>[[register:alternative-registration]]</label>
					<ul class="alt-logins list-unstyled">
						{{{ each authentication }}}
						<li class="{./name} mb-2">
							<a class="btn btn-outline-light d-flex align-items-center" rel="nofollow noopener noreferrer" target="_top" href="{config.relative_path}{./url}">
								{{{ if ./icons.svg }}}
								{./icons.svg}
								{{{ else }}}
								<i class="flex-shrink-0 {./icons.normal}" style="color:{./color};"></i>
								{{{ end }}}
								{{{ if ./labels.register }}}
								<div class="flex-grow-1 text-body text-sm">{./labels.register}</div>
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