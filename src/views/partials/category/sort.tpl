<div class="btn-group bottom-sheet" component="thread/sort">
	<button class="btn btn-ghost btn-sm ff-secondary d-flex gap-2 align-items-center dropdown-toggle" data-bs-toggle="dropdown" type="button" aria-haspopup="true" aria-expanded="false" aria-label="[[aria:topic-sort-option, {sortOptionLabel}]]">
		<i class="fa fa-fw fa-arrow-down-wide-short text-primary"></i>
		<span class="d-none d-md-inline fw-semibold">{sortOptionLabel}</span>
	</button>

	<ul class="dropdown-menu p-1 text-sm" role="menu">
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-sort="recently_replied" role="menuitem">
				<span class="flex-grow-1">[[topic:recently-replied]]</span>
				<i class="flex-shrink-0 fa fa-fw text-secondary"></i>
			</a>
		</li>
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-sort="recently_created" role="menuitem">
				<span class="flex-grow-1">[[topic:recently-created]]</span>
				<i class="flex-shrink-0 fa fa-fw text-secondary"></i>
			</a>
		</li>
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-sort="most_posts" role="menuitem">
				<span class="flex-grow-1">[[topic:most-posts]]</span>
				<i class="flex-shrink-0 fa fa-fw text-secondary"></i>
			</a>
		</li>
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-sort="most_votes" role="menuitem">
				<span class="flex-grow-1">[[topic:most-votes]]</span>
				<i class="flex-shrink-0 fa fa-fw text-secondary"></i>
			</a>
		</li>
		<li>
			<a class="dropdown-item rounded-1 d-flex align-items-center gap-2" href="#" data-sort="most_views" role="menuitem">
				<span class="flex-grow-1">[[topic:most-views]]</span>
				<i class="flex-shrink-0 fa fa-fw text-secondary"></i>
			</a>
		</li>
	</ul>
</div>