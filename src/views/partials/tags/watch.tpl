{{{ if config.loggedIn }}}
<div class="btn-group bottom-sheet" component="tag/watch">
	<button class="btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center dropdown-toggle" data-bs-toggle="dropdown" type="button" aria-haspopup="true" aria-expanded="false">
		<span component="tag/following/menu" class="d-flex gap-2 align-items-center{{{ if !isFollowing }}} hidden{{{ end }}}">
			<i class="flex-shrink-0 fa fa-fw fa-bell-o text-primary"></i>
			<span class="d-none d-md-inline fw-semibold">[[tags:watching]]</span>
		</span>

		<span component="tag/not-following/menu" class="d-flex gap-2 align-items-center{{{ if isFollowing}}} hidden{{{ end }}}">
			<i class="flex-shrink-0 fa fa-fw fa-bell-slash-o text-primary"></i>
			<span class="d-none d-md-inline fw-semibold">[[tags:not-watching]]</span>
		</span>
	</button>
	<ul class="dropdown-menu p-1 text-sm" role="menu">
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="tag/following" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-bell-o"></i>
						<span class="flex-grow-1 fw-semibold">[[tags:watching]]</span>
					</span>
					<div class="help-text text-muted text-xs">[[tags:watching.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="tag/following/check" class="fa fa-fw {{{ if isFollowing }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>

		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="tag/not-following" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-bell-slash-o"></i>
						<span class="flex-grow-1 fw-semibold">[[tags:not-watching]]</span>
					</span>
					<div class="help-text text-muted text-xs">[[tags:not-watching.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="tag/not-following/check" class="fa fa-fw {{{ if !isFollowing }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>
	</ul>
</div>
{{{ end }}}