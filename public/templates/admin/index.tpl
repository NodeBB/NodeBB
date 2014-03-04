<div class="home">

	<div class="col-sm-6">
		<div class="panel panel-default">
			<div class="panel-heading">Welcome to NodeBB</div>
			<div class="panel-body">
				<p>
					<a target="_blank" href="http://community.nodebb.org" class="btn btn-default btn-sm"><i class="fa fa-comment"></i> NodeBB Community Forum</a>
					<a target="_blank" href="http://community.nodebb.org/" class="btn btn-default btn-sm"><i class="fa fa-github-alt"></i> Get Plugins and Themes</a>
					<a target="_blank" href="http://www.twitter.com/NodeBB" class="btn btn-default btn-sm"><i class="fa fa-twitter"></i> Follow @NodeBB</a>
					<a target="_blank" href="https://github.com/designcreateplay/NodeBB/wiki" class="btn btn-default btn-sm"><i class="fa fa-question-circle"></i> NodeBB Wiki</a>
				</p>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Notices</div>
			<div class="panel-body">
				<div>
					<!-- IF emailerInstalled --><i class="fa fa-check alert-success"></i><!-- ELSE --><i class="fa fa-times alert-danger"></i><!-- ENDIF emailerInstalled --> Emailer Installed
				</div>
				<div>
					<!-- IF searchInstalled --><i class="fa fa-check alert-success"></i><!-- ELSE --><i class="fa fa-times alert-danger"></i><!-- ENDIF searchInstalled --> Search Plugin Installed
				</div>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Unique Visitors</div>
			<div class="panel-body">
				<div id="unique-visitors">
					<div class="text-center pull-left">
						<div id="day"></div>
						<div>Day</div>
					</div>
					<div class="text-center pull-left">
						<div id="week"></div>
						<div>Week</div>
					</div>
					<div class="text-center pull-left">
						<div id="month"></div>
						<div>Month</div>
					</div>
					<div class="text-center pull-left">
						<div id="alltime"></div>
						<div>All Time</div>
					</div>
				</div>
			</div>
		</div>

	</div>


	<div class="col-sm-6 pull-right">
		<div class="panel panel-default">
			<div class="panel-heading">Updates</div>
			<div class="panel-body">
				<div class="alert alert-info version-check">
					<p>You are running <strong>NodeBB v<span id="version">{version}</span></strong>.</p>
				</div>
				<p>
					Always make sure that your <strong>NodeBB</strong> is up to date for the latest security patches and bug fixes.
				</p>
				<p class="pull-right">
					<button class="btn btn-warning restart">Restart NodeBB</button>
				</p>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Active Users <small><span class="badge" id="connections"></span> socket connections</small></div>
			<div class="panel-body">
				<div id="active_users"></div>
			</div>
		</div>

	</div>
</div>