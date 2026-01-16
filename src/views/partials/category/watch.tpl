{{{ if config.loggedIn }}}
<div class="btn-group bottom-sheet" component="topic/watch">
	<button class="btn btn-ghost btn-sm ff-secondary dropdown-toggle" data-bs-toggle="dropdown" type="button" aria-haspopup="true" aria-expanded="false">
		<span component="category/watching/menu" class="d-flex gap-2 align-items-center {{{ if !./isWatched }}} hidden{{{ end }}}"><i class="fa fa-fw fa-bell-o text-primary"></i><span class="visible-md-inline visible-lg-inline fw-semibold">[[category:watching]]</span></span>

		<span component="category/tracking/menu"  class="d-flex gap-2 align-items-center {{{ if !./isTracked }}} hidden{{{ end }}}"><i class="fa fa-fw fa-inbox text-primary"></i><span class="visible-md-inline visible-lg-inline fw-semibold">[[category:tracking]]</span></span>

		<span component="category/notwatching/menu"  class="d-flex gap-2 align-items-center {{{ if !./isNotWatched }}} hidden{{{ end }}}"><i class="fa fa-fw fa-clock-o text-primary"></i><span class="visible-md-inline visible-lg-inline fw-semibold">[[category:not-watching]]</span></span>

		<span component="category/ignoring/menu"  class="d-flex gap-2 align-items-center {{{ if !./isIgnored }}} hidden{{{ end }}}"><i class="fa fa-fw fa-eye-slash text-primary"></i><span class="visible-md-inline visible-lg-inline fw-semibold">[[category:ignoring]]</span></span>
	</button>

	<ul class="dropdown-menu p-1 text-sm {{{ if template.account/categories }}}dropdown-menu-end{{{ end }}}" role="menu">
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="category/watching" data-state="watching" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-bell-o text-secondary"></i>
						<span class="flex-grow-1 fw-semibold">[[category:watching]]</span>
					</span>
					<div class="help-text text-secondary text-xs">[[category:watching.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="category/watching/check" class="fa fa-fw {{{ if ./isWatched }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>

		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="category/tracking" data-state="tracking" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-inbox text-secondary"></i>
						<span class="flex-grow-1 fw-semibold">[[category:tracking]]</span>
					</span>
					<div class="help-text text-secondary text-xs">[[category:tracking.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="category/tracking/check" class="fa fa-fw {{{ if ./isTracked }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>

		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="category/notwatching" data-state="notwatching" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-clock-o text-secondary"></i>
						<span class="flex-grow-1 fw-semibold">[[category:not-watching]]</span>
					</span>
					<div class="help-text text-secondary text-xs">[[category:not-watching.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="category/notwatching/check" class="fa fa-fw {{{ if ./isNotWatched }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>

		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2 p-2" href="#" component="category/ignoring" data-state="ignoring" role="menuitem">
				<div class="flex-grow-1 d-flex flex-column">
					<span class="d-flex align-items-center gap-2">
						<i class="flex-shrink-0 fa fa-fw fa-eye-slash text-secondary"></i>
						<span class="flex-grow-1 fw-semibold">[[category:ignoring]]</span>
					</span>
					<div class="help-text text-secondary text-xs">[[category:ignoring.description]]</div>
				</div>
				<span class="flex-shrink-0"><i component="category/ignoring/check" class="fa fa-fw {{{ if ./isIgnored }}}fa-check{{{ end }}}"></i></span>
			</a>
		</li>
	</ul>
</div>
{{{ end }}}