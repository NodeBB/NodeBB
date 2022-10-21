<!-- IMPORT admin/partials/settings/header.tpl -->


<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/reputation:reputation]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check">
				<input type="checkbox" class="form-check-input" data-field="reputation:disabled">
				<label class="form-check-label">[[admin/settings/reputation:disable]]</label>
			</div>
			<div class="form-check">
				<input type="checkbox" class="form-check-input" data-field="downvote:disabled">
				<label class="form-check-label">[[admin/settings/reputation:disable-down-voting]]</label>
			</div>
			<div class="form-check">
				<input type="checkbox" class="form-check-input" data-field="votesArePublic">
				<label class="form-check-label">[[admin/settings/reputation:votes-are-public]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/reputation:thresholds]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="min:rep:chat">[[admin/settings/reputation:min-rep-chat]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:chat" id="min:rep:chat">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:upvote">[[admin/settings/reputation:min-rep-upvote]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:upvote" id="min:rep:upvote">
			</div>
			<div class="mb-3">
				<label class="form-label" for="upvotesPerDay">[[admin/settings/reputation:upvotes-per-day]]</label>
				<input type="text" class="form-control" placeholder="10" data-field="upvotesPerDay" id="upvotesPerDay">
			</div>
			<div class="mb-3">
				<label class="form-label" for="upvotesPerUserPerDay">[[admin/settings/reputation:upvotes-per-user-per-day]]</label>
				<input type="text" class="form-control" placeholder="3" data-field="upvotesPerUserPerDay" id="upvotesPerUserPerDay">
			</div>

			<div class="mb-3">
				<label class="form-label" for="min:rep:downvote">[[admin/settings/reputation:min-rep-downvote]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:downvote" id="min:rep:downvote">
			</div>
			<div class="mb-3">
				<label for="downvotesPerDay">[[admin/settings/reputation:downvotes-per-day]]</label>
				<input type="text" class="form-control" placeholder="10" data-field="downvotesPerDay" id="downvotesPerDay">
			</div>
			<div class="mb-3">
				<label class="form-label" for="downvotesPerUserPerDay">[[admin/settings/reputation:downvotes-per-user-per-day]]</label>
				<input type="text" class="form-control" placeholder="3" data-field="downvotesPerUserPerDay" id="downvotesPerUserPerDay">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:flag">[[admin/settings/reputation:min-rep-flag]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:flag" id="min:rep:flag">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:website">[[admin/settings/reputation:min-rep-website]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:website" id="min:rep:website">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:aboutme">[[admin/settings/reputation:min-rep-aboutme]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:aboutme" id="min:rep:aboutme">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:signature">[[admin/settings/reputation:min-rep-signature]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:signature" id="min:rep:signature">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:profile-picture">[[admin/settings/reputation:min-rep-profile-picture]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:profile-picture" id="min:rep:profile-picture">
			</div>
			<div class="mb-3">
				<label class="form-label" for="min:rep:cover-picture">[[admin/settings/reputation:min-rep-cover-picture]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:cover-picture" id="min:rep:cover-picture">
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/reputation:flags]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label" for="flags:limitPerTarget">[[admin/settings/reputation:flags.limit-per-target]]</label>
				<input type="text" class="form-control" placeholder="[[admin/settings/reputation:flags.limit-per-target-placeholder]]" data-field="flags:limitPerTarget" id="flags:limitPerTarget">
				<p class="form-text">
					[[admin/settings/reputation:flags.limit-per-target-help]]
				</p>
			</div>
			<div class="mb-3">
				<label class="form-label" for="flags:autoFlagOnDownvoteThreshold">[[admin/settings/reputation:flags.auto-flag-on-downvote-threshold]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="flags:autoFlagOnDownvoteThreshold" id="flags:autoFlagOnDownvoteThreshold">
			</div>
			<div class="row">
				<div class="col-sm-6">
					<div class="mb-3">
						<label class="form-label" for="flags:actionOnResolve">[[admin/settings/reputation:flags.action-on-resolve]]</label>
						<select class="form-select" data-field="flags:actionOnResolve" name="flags:actionOnResolve" id="flags:actionOnResolve">
							<option value="">[[admin/settings/reputation:flags.action.nothing]]</option>
							<option value="rescind">[[admin/settings/reputation:flags.action.rescind]]</option>
						</select>
					</div>
				</div>
				<div class="col-sm-6">
					<div class="mb-3">
						<label class="form-label" for="flags:actionOnReject">[[admin/settings/reputation:flags.action-on-reject]]</label>
						<select class="form-select" data-field="flags:actionOnReject" name="flags:actionOnReject" id="flags:actionOnReject">
							<option value="">[[admin/settings/reputation:flags.action.nothing]]</option>
							<option value="rescind">[[admin/settings/reputation:flags.action.rescind]]</option>
						</select>
					</div>
				</div>
			</div>
			<div class="form-check">
				<input type="checkbox" class="form-check-input" data-field="flags:autoResolveOnBan">
				<label class="form-check-label">[[admin/settings/reputation:flags.auto-resolve-on-ban]]</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
