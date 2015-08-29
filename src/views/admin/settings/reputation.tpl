<!-- IMPORT admin/settings/header.tpl -->


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:reputation.reputation_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="reputation:disabled">
					<span class="mdl-switch__label"><strong>[[admin:reputation.disable_reputation_system]]</strong></span>
				</label>
			</div>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input type="checkbox" class="mdl-switch__input" data-field="downvote:disabled">
					<span class="mdl-switch__label"><strong>[[admin:reputation.disable_down_voting]]</trong></strong>
				</label>
			</div>
		</form>
	</div>
</div>


<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:reputation.activity_thresholds]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin:reputation.minimum_reputation_to_downvote_posts]]</strong><br /> <input type="text" class="form-control" placeholder="0" data-field="privileges:downvote"><br />
			<strong>[[admin:reputation.minimum_reputation_to_flag_posts]]</strong><br /> <input type="text" class="form-control" placeholder="0" data-field="privileges:flag"><br />
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->