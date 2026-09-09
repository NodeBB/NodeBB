<div class="">
	<div class="col-12">
		<ul class="nav nav-tabs mb-3" role="tablist">
			<li class="nav-item" role="presentation">
				<button
					class="nav-link active fw-semibold"
					id="invite-member-tab"
					data-bs-toggle="tab"
					data-bs-target="#invite-member-pane"
					type="button"
					role="tab"
					aria-controls="invite-member-pane"
					aria-selected="true"
				>
					{{tx("groups:invite-members")}}
				</button>
			</li>

			<li class="nav-item" role="presentation">
				<button
					class="nav-link fw-semibold"
					id="bulk-invite-tab"
					data-bs-toggle="tab"
					data-bs-target="#bulk-invite-pane"
					type="button"
					role="tab"
					aria-controls="bulk-invite-pane"
					aria-selected="false"
				>
					{{tx("groups:bulk-invite")}}
				</button>
			</li>
		</ul>

		<div class="tab-content">
			<div
				class="tab-pane fade show active"
				id="invite-member-pane"
				role="tabpanel"
				aria-labelledby="invite-member-tab"
				tabindex="0"
			>
				<label class="form-label text-sm">{{tx("groups:invited.search")}}</label>
				<div class="input-group mb-3">
					<input class="form-control" type="text" component="groups/members/invite"/>
					<span class="input-group-text search-button"><i class="fa fa-search"></i></span>
				</div>
				<div component="groups/members/invite-results" class="d-flex">
					{{{ each selectedUsers }}}
					<div data-uid="{./uid}" class="badge text-bg-light m-1 p-1 border d-inline-flex gap-1 align-items-center">
						{{buildAvatar(@value, "24px", true)}}
						<a href="{config.relative_path}/user/{./userslug}">{./username}</a>
						<button class="btn btn-ghost btn-sm p-0" data-action="remove">
							<i class="fa fa-fw fa-times"></i>
						</button>
					</div>
					{{{ end }}}
				</div>
			</div>

			<div
				class="tab-pane fade"
				id="bulk-invite-pane"
				role="tabpanel"
				aria-labelledby="bulk-invite-tab"
				tabindex="0"
			>
				<div class="">
					<label class="form-label text-sm">{{tx("groups:bulk-invite-instructions")}}</label>
					<textarea class="form-control" component="groups/members/bulk-invite"></textarea>
				</div>
			</div>
		</div>
	</div>
</div>