<!-- IMPORT admin/partials/settings/header.tpl -->


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/reputation:reputation]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="reputation:disabled">
					<span class="mdl-switch__label"><strong>[[admin/settings/reputation:disable]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="downvote:disabled">
					<span class="mdl-switch__label"><strong>[[admin/settings/reputation:disable-down-voting]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="votesArePublic">
					<span class="mdl-switch__label"><strong>[[admin/settings/reputation:votes-are-public]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/reputation:thresholds]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="min:rep:downvote">[[admin/settings/reputation:min-rep-downvote]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:downvote" id="min:rep:downvote">
			</div>
			<div class="form-group">
				<label for="downvotesPerDay">[[admin/settings/reputation:downvotes-per-day]]</label>
				<input type="text" class="form-control" placeholder="10" data-field="downvotesPerDay" id="downvotesPerDay">
			</div>
			<div class="form-group">
				<label for="downvotesPerUserPerDay">[[admin/settings/reputation:downvotes-per-user-per-day]]</label>
				<input type="text" class="form-control" placeholder="3" data-field="downvotesPerUserPerDay" id="downvotesPerUserPerDay">
			</div>
			<div class="form-group">
				<label for="min:rep:flag">[[admin/settings/reputation:min-rep-flag]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:flag" id="min:rep:flag">
			</div>
			<div class="form-group">
				<label for="min:rep:website">[[admin/settings/reputation:min-rep-website]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:website" id="min:rep:website">
			</div>
			<div class="form-group">
				<label for="min:rep:aboutme">[[admin/settings/reputation:min-rep-aboutme]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:aboutme" id="min:rep:aboutme">
			</div>
			<div class="form-group">
				<label for="min:rep:signature">[[admin/settings/reputation:min-rep-signature]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:signature" id="min:rep:signature">
			</div>
			<div class="form-group">
				<label for="min:rep:profile-picture">[[admin/settings/reputation:min-rep-profile-picture]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:profile-picture" id="min:rep:profile-picture">
			</div>
			<div class="form-group">
				<label for="min:rep:cover-picture">[[admin/settings/reputation:min-rep-cover-picture]]</label>
				<input type="text" class="form-control" placeholder="0" data-field="min:rep:cover-picture" id="min:rep:cover-picture">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/reputation:flags]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="form-group">
				<label for="flags:limitPerTarget">[[admin/settings/reputation:flags.limit-per-target]]</label>
				<input type="text" class="form-control" placeholder="[[admin/settings/reputation:flags.limit-per-target-placeholder]]" data-field="flags:limitPerTarget" id="flags:limitPerTarget">
				<p class="help-block">
					[[admin/settings/reputation:flags.limit-per-target-help]]
				</p>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="flags:autoResolveOnBan">
					<span class="mdl-switch__label"><strong>[[admin/settings/reputation:flags.auto-resolve-on-ban]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
