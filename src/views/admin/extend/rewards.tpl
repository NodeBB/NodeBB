<div id="rewards">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:rewards.rewards]]</div>
			<div class="panel-body">
				<ul id="active">
					<!-- BEGIN active -->
					<li data-rid="{active.rid}" data-id="{active.id}">
						<form class="main inline-block">
							<div class="well inline-block">
								<label for="condition">[[admin:rewards.if_user]]</label><br />
								<select name="condition" data-selected="{active.condition}">
									<!-- BEGIN conditions -->
									<option value="{conditions.condition}">{conditions.name}</option>
									<!-- END conditions -->
								</select>
							</div>
							<div class="well inline-block">
								<label for="condition">[[admin:rewards.is]]</label><br />
								<select name="conditional" data-selected="{active.conditional}">
									<!-- BEGIN conditionals -->
									<option value="{conditionals.conditional}">{conditionals.name}</option>
									<!-- END conditionals -->
								</select>
								<input type="text" name="value" value="{active.value}" />
							</div>
							<div class="well inline-block">
								<label for="condition">[[admin:rewards.then]]</label><br />
								<select name="rid" data-selected="{active.rid}">
									<!-- BEGIN rewards -->
									<option value="{rewards.rid}">{rewards.name}</option>
									<!-- END rewards -->
								</select>
							</div>
						</form>

						<form class="rewards inline-block">
							<div class="inputs well inline-block"></div>
						</form>
						<div class="clearfix"></div>

						<div class="pull-right">
							<div class="panel-body inline-block">
								<form class="main">
									<label for="claimable">[[admin:rewards.amount_of_times_reward_is_claimable]]</label><br />
									<input type="text" name="claimable" value="{active.claimable}" placeholder="1" />
									<small>[[admin:rewards.enter_0_for_infinite]]</small>
								</form>
							</div>
							<div class="panel-body inline-block">
								<button class="btn btn-danger delete">[[admin:rewards.delete]]</button>
								<!-- IF active.disabled -->
								<button class="btn btn-success toggle">[[admin:rewards.enable]]</button>
								<!-- ELSE -->
								<button class="btn btn-warning toggle">[[admin:rewards.disable]]</button>
								<!-- ENDIF active.disabled -->
							</div>
						</div>
						<div class="clearfix"></div>
					</li>
					<!-- END active -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:rewards.rewards_control]]</div>
			<div class="panel-body">
				<button class="btn btn-success btn-md" id="new">[[admin:rewards.new_reward]]</button>
				<button class="btn btn-primary btn-md" id="save">[[admin:rewards.save_changes]]</button>
			</div>
		</div>
	</div>
</div>