<div class="mb-3">
	<p class="lead">{{tx("user:consent.lead")}}</p>
	<p>{{tx("user:consent.intro")}}</p>
	<div class="form-check mb-3">
		<input class="form-check-input" type="checkbox" name="gdpr_agree_data" id="gdpr_agree_data" role="switch">
		<label class="form-check-label" for="gdpr_agree_data">{{tx("register:gdpr-agree-data")}}</label>
	</div>

	<p>
		{{tx("user:consent.email-intro")}}
		{{{ if digestEnabled }}}
		{{tx("user:consent.digest-frequency", digestFrequency)}}
		{{{ else }}}
		{{tx("user:consent.digest-off")}}
		{{{ end }}}
	</p>

	<div class="form-check">
		<input class="form-check-input" type="checkbox" name="gdpr_agree_email" id="gdpr_agree_email" role="switch">
		<label class="form-check-label" for="gdpr_agree_email">{{tx("register:gdpr-agree-email")}}</label>
	</div>
</div>