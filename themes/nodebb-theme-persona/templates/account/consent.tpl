<div class="account">
	<!-- IMPORT partials/account/header.tpl -->
	<h2>[[user:consent.title]]</h2>
	<p class="lead">[[user:consent.lead]]</p>
	<p>[[user:consent.intro]]</p>

	<hr />

	<div class="row">
		<div class="col-sm-6">
			<!-- IF gdpr_consent -->
			<div class="alert alert-success">
				<i class="fa fa-check pull-right fa-3x"></i>
				[[user:consent.received]]
			</div>
			<!-- ELSE -->
			<div class="alert alert-warning">
				[[user:consent.not_received]]
				<br /><br />
				<div class="text-center">
					<button class="btn btn-warning" data-action="consent">[[user:consent.give]]</button>
				</div>
			</div>
			<!-- END -->
			<div class="panel panel-default">
				<div class="panel-body">
					<p>[[user:consent.email_intro]]</p>
					<!-- IF digest.enabled -->
					<p>[[user:consent.digest_frequency, {digest.frequency}]]</p>
					<!-- ELSE -->
					[[user:consent.digest_off]]
					<!-- END -->

					<div class="text-center">
						<a class="btn btn-default" href="./settings">
							<i class="fa fa-cog"></i>
							[[pages:account/settings]]
						</a>
					</div>
				</div>
			</div>
		</div>
		<div class="col-sm-6">
			<div class="panel panel-default">
				<div class="panel-body">
					<p><strong>[[user:consent.right_of_access]]</strong></p>
					<p>[[user:consent.right_of_access_description]]</p>
					<p><strong>[[user:consent.right_to_rectification]]</strong></p>
					<p>[[user:consent.right_to_rectification_description]]</p>
					<p><strong>[[user:consent.right_to_erasure]]</strong></p>
					<p>[[user:consent.right_to_erasure_description]]</p>
					<p><strong>[[user:consent.right_to_data_portability]]</strong></p>
					<p>[[user:consent.right_to_data_portability_description]]</p>

					<div class="btn-group-vertical btn-block">
						<a data-action="export-profile" class="btn btn-default">
							<i class="fa fa-download"></i> [[user:consent.export_profile]]
						</a>
						<a data-action="export-posts" class="btn btn-default">
							<i class="fa fa-download"></i> [[user:consent.export_posts]]
						</a>
						<a data-action="export-uploads" class="btn btn-default">
							<i class="fa fa-download"></i> [[user:consent.export_uploads]]
						</a>
					</div>
				</div>
			</div>
	</div>
</div>