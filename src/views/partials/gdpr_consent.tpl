<div class="form-group">
	<p class="lead">[[register:gdpr_lead]]</p>
	<p>[[register:gdpr_intro]]</p>
	<div class="checkbox">
		<label>
			<input type="checkbox" name="gdpr_agree_data" id="gdpr_agree_data"> <strong>[[register:gdpr_agree_data]]</strong>
		</label>
	</div>
	<p>
		[[register:gdpr_email_intro]]
		<!-- IF digestEnabled -->
		[[register:gdpr_digest_frequency, {digestFrequency}]]
		<!-- ELSE -->
		[[register:gdpr_digest_off]]
		<!-- END -->
	</p>
	
	<div class="checkbox">
		<label>
			<input type="checkbox" name="gdpr_agree_email" id="gdpr_agree_email"> <strong>[[register:gdpr_agree_email]]</strong>
		</label>
	</div>
</div>