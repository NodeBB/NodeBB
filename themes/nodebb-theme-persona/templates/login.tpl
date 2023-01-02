<!-- IMPORT partials/breadcrumbs.tpl -->
<div data-widget-area="header">
	{{{each widgets.header}}}
	{{widgets.header.html}}
	{{{end}}}
</div>
<div class="row login">
	<div class="{{{ if widgets.sidebar.length }}}col-lg-9 col-sm-12{{{ else }}}col-lg-12{{{ end }}}">
		<div class="row">
			{{{ if allowLocalLogin }}}
			<div class="{{{ if alternate_logins }}}col-md-6{{{ else }}}col-md-12{{{ end }}}">
				<div class="login-block">
					<div class="alert alert-danger" id="login-error-notify" <!-- IF error -->style="display:block"<!-- ELSE -->style="display: none;"<!-- ENDIF error -->>
						<button type="button" class="close" data-dismiss="alert">&times;</button>
						<strong>[[login:failed_login_attempt]]</strong>
						<p>{error}</p>
					</div>

					<form class="form-horizontal" role="form" method="post" id="login-form">
						<div class="form-group">
							<label for="username" class="col-lg-2 control-label">{allowLoginWith}</label>
							<div class="col-lg-10">
								<input class="form-control" type="text" placeholder="{allowLoginWith}" name="username" id="username" autocorrect="off" autocapitalize="off" value="{username}"/>
							</div>
						</div>
						<div class="form-group">
							<label for="password" class="col-lg-2 control-label">[[user:password]]</label>
							<div class="col-lg-10">
								<input class="form-control" type="password" placeholder="[[user:password]]" name="password" id="password" <!-- IF username -->autocomplete="off"<!-- ENDIF username -->/>
								<p id="caps-lock-warning" class="text-danger hidden">
									<i class="fa fa-exclamation-triangle"></i> [[login:caps-lock-enabled]]
								</p>
							</div>
						</div>
						<div class="form-group">
							<div class="col-lg-offset-2 col-lg-10">
								<div class="checkbox">
									<label>
										<input type="checkbox" name="remember" id="remember" checked /> [[login:remember_me]]
									</label>
								</div>
							</div>
						</div>
						{{{each loginFormEntry}}}
						<div class="form-group loginFormEntry">
							<label for="login-{loginFormEntry.styleName}" class="col-lg-4 control-label">{loginFormEntry.label}</label>
							<div id="login-{loginFormEntry.styleName}" class="col-lg-8">{{loginFormEntry.html}}</div>
						</div>
						{{{end}}}
						<input type="hidden" name="_csrf" value="{config.csrf_token}" />
						<input type="hidden" name="noscript" id="noscript" value="true" />
						<div class="form-group">
							<div class="col-lg-offset-2 col-lg-10">
								<button class="btn btn-primary btn-lg btn-block" id="login" type="submit">[[global:login]]</button>
								<!-- IF allowRegistration -->
								<span>[[login:dont_have_account]] <a href="{config.relative_path}/register">[[register:register]]</a></span>
								<!-- ENDIF allowRegistration -->
								<!-- IF allowPasswordReset -->
								&nbsp; <a id="reset-link" href="{config.relative_path}/reset">[[login:forgot_password]]</a>
								<!-- ENDIF allowPasswordReset -->
							</div>
						</div>
					</form>

				</div>
			</div>
			{{{ end }}}

			{{{ if alternate_logins }}}
			<div class="{{{ if allowLocalLogin }}}col-md-6{{{ else }}}col-md-12{{{ end }}}">
				<div class="alt-login-block">
					<h4>[[login:alternative_logins]]</h4>
					<ul class="alt-logins">
						{{{each authentication}}}
						<li class="{authentication.name}"><a rel="nofollow noopener noreferrer" target="_top" href="{config.relative_path}{authentication.url}"><i class="fa {authentication.icon} fa-3x"></i></a></li>
						{{{end}}}
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