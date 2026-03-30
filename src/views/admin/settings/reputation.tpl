<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="reputation-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/reputation:reputation]]</h5>

				<div class="form-check form-switch mb-3">
					<input type="checkbox" class="form-check-input" id="reputation:disabled" data-field="reputation:disabled">
					<label for="reputation:disabled" class="form-check-label">[[admin/settings/reputation:disable]]</label>
				</div>
				<div class="form-check form-switch mb-3">
					<input type="checkbox" class="form-check-input" id="downvote:disabled" data-field="downvote:disabled">
					<label for="downvote:disabled" class="form-check-label">[[admin/settings/reputation:disable-down-voting]]</label>
				</div>
				<div class="mb-3">
					<label for="upvoteVisibility" class="form-label">[[admin/settings/reputation:upvote-visibility]]</label>
					<select id="upvoteVisibility" data-field="upvoteVisibility" class="form-select">
						<option value="all">[[admin/settings/reputation:upvote-visibility-all]]</option>
						<option value="loggedin">[[admin/settings/reputation:upvote-visibility-loggedin]]</option>
						<option value="privileged">[[admin/settings/reputation:upvote-visibility-privileged]]</option>
					</select>
				</div>
				<div>
					<label for="downvoteVisibility" class="form-label">[[admin/settings/reputation:downvote-visibility]]</label>
					<select id="downvoteVisibility" data-field="downvoteVisibility" class="form-select">
						<option value="all">[[admin/settings/reputation:downvote-visibility-all]]</option>
						<option value="loggedin">[[admin/settings/reputation:downvote-visibility-loggedin]]</option>
						<option value="privileged">[[admin/settings/reputation:downvote-visibility-privileged]]</option>
					</select>
				</div>
			</div>

			<hr/>

			<div id="activity-thresholds" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/reputation:thresholds]]</h5>
				<div class="mb-3">
					<label class="form-label" for="min:rep:chat">[[admin/settings/reputation:min-rep-chat]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:chat" id="min:rep:chat">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:upvote">[[admin/settings/reputation:min-rep-upvote]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:upvote" id="min:rep:upvote">
				</div>
				<div class="mb-3">
					<label class="form-label" for="upvotesPerDay">[[admin/settings/reputation:upvotes-per-day]]</label>
					<input type="number" min="0" class="form-control" placeholder="10" data-field="upvotesPerDay" id="upvotesPerDay">
				</div>
				<div class="mb-3">
					<label class="form-label" for="upvotesPerUserPerDay">[[admin/settings/reputation:upvotes-per-user-per-day]]</label>
					<input type="number" min="0" class="form-control" placeholder="3" data-field="upvotesPerUserPerDay" id="upvotesPerUserPerDay">
				</div>

				<div class="mb-3">
					<label class="form-label" for="min:rep:downvote">[[admin/settings/reputation:min-rep-downvote]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:downvote" id="min:rep:downvote">
				</div>
				<div class="mb-3">
					<label class="form-label" for="downvotesPerDay">[[admin/settings/reputation:downvotes-per-day]]</label>
					<input type="number" min="0" class="form-control" placeholder="10" data-field="downvotesPerDay" id="downvotesPerDay">
				</div>
				<div class="mb-3">
					<label class="form-label" for="downvotesPerUserPerDay">[[admin/settings/reputation:downvotes-per-user-per-day]]</label>
					<input type="number" min="0" class="form-control" placeholder="3" data-field="downvotesPerUserPerDay" id="downvotesPerUserPerDay">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:post-links">[[admin/settings/reputation:min-rep-post-links]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:post-links" id="min:rep:post-links">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:flag">[[admin/settings/reputation:min-rep-flag]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:flag" id="min:rep:flag">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:aboutme">[[admin/settings/reputation:min-rep-aboutme]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:aboutme" id="min:rep:aboutme">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:signature">[[admin/settings/reputation:min-rep-signature]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:signature" id="min:rep:signature">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:profile-picture">[[admin/settings/reputation:min-rep-profile-picture]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:profile-picture" id="min:rep:profile-picture">
				</div>
				<div class="mb-3">
					<label class="form-label" for="min:rep:cover-picture">[[admin/settings/reputation:min-rep-cover-picture]]</label>
					<input type="number" class="form-control" placeholder="0" data-field="min:rep:cover-picture" id="min:rep:cover-picture">
				</div>
			</div>

			<hr/>

			<div id="flag-settings" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header">[[admin/settings/reputation:flags]]</h5>
				<div class="mb-3">
					<label class="form-label" for="flags:limitPerTarget">[[admin/settings/reputation:flags.limit-per-target]]</label>
					<input type="number" min="0" class="form-control" placeholder="[[admin/settings/reputation:flags.limit-per-target-placeholder]]" data-field="flags:limitPerTarget" id="flags:limitPerTarget">
					<p class="form-text">
						[[admin/settings/reputation:flags.limit-per-target-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="flags:postFlagsPerDay">[[admin/settings/reputation:flags.limit-post-flags-per-day]]</label>
					<input type="number" min="0" class="form-control" data-field="flags:postFlagsPerDay" id="flags:postFlagsPerDay">
					<p class="form-text">
						[[admin/settings/reputation:flags.limit-post-flags-per-day-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="flags:userFlagsPerDay">[[admin/settings/reputation:flags.limit-user-flags-per-day]]</label>
					<input type="number" min="0" class="form-control" data-field="flags:userFlagsPerDay" id="flags:userFlagsPerDay">
					<p class="form-text">
						[[admin/settings/reputation:flags.limit-user-flags-per-day-help]]
					</p>
				</div>


				<div class="mb-3">
					<label class="form-label" for="flags:autoFlagOnDownvoteThreshold">[[admin/settings/reputation:flags.auto-flag-on-downvote-threshold]]</label>
					<input type="number" min="0" class="form-control" placeholder="0" data-field="flags:autoFlagOnDownvoteThreshold" id="flags:autoFlagOnDownvoteThreshold">
					<p class="form-text">
						[[admin/settings/reputation:flags.auto-flag-on-downvote-threshold-help]]
					</p>
				</div>

				<div class="mb-3">
					<label class="form-label" for="flags:actionOnResolve">[[admin/settings/reputation:flags.action-on-resolve]]</label>
					<select class="form-select" data-field="flags:actionOnResolve" name="flags:actionOnResolve" id="flags:actionOnResolve">
						<option value="">[[admin/settings/reputation:flags.action.nothing]]</option>
						<option value="rescind">[[admin/settings/reputation:flags.action.rescind]]</option>
					</select>
				</div>

				<div class="mb-3">
					<label class="form-label" for="flags:actionOnReject">[[admin/settings/reputation:flags.action-on-reject]]</label>
					<select class="form-select" data-field="flags:actionOnReject" name="flags:actionOnReject" id="flags:actionOnReject">
						<option value="">[[admin/settings/reputation:flags.action.nothing]]</option>
						<option value="rescind">[[admin/settings/reputation:flags.action.rescind]]</option>
					</select>
				</div>

				<div class="form-check form-switch mb-3">
					<input type="checkbox" class="form-check-input" id="flags:autoResolveOnBan" data-field="flags:autoResolveOnBan">
					<label for="flags:autoResolveOnBan" class="form-check-label">[[admin/settings/reputation:flags.auto-resolve-on-ban]]</label>
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
