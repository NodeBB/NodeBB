<div class="form-group">
	<p class="lead">[[user:consent.lead]]</p>
	<p>[[user:consent.intro]]</p>
	<div class="checkbox">
		<label>
			<input type="checkbox" name="gdpr_agree_data" id="gdpr_agree_data"> <strong>[[register:gdpr_agree_data]]</strong>
		</label>
	</div>
	<p>
		[[user:consent.email_intro]]
		<!-- IF digestEnabled -->
		[[user:consent.digest_frequency, {digestFrequency}]]
		<!-- ELSE -->
		[[user:consent.digest_off]]
		<!-- END -->
	</p>
	
	<div class="checkbox">
		<label>
			<input type="checkbox" name="gdpr_agree_email" id="gdpr_agree_email"> <strong>[[register:gdpr_agree_email]]</strong>
		</label>
	</div>
</div>