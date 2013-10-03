<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
	</li>
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="/reset" itemprop="url"><span itemprop="title">Reset Password</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">Update Password</span>
	</li>
</ol>


<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Changed</strong>
		<p>Password successfully reset, please <a href="/login">log in again</a>.</p>
	</div>
	<div class="alert alert-warning" id="notice" style="display:none">
		<strong></strong>
		<p></p>
	</div>
	<div class="alert alert-danger" id="error" style="display:none">
		<strong>Incorrect Reset Code</strong>
		<p>The reset code received was incorrect. Please try again, or <a href="/reset">request a new reset code</a></p>
	</div>
	<form onsubmit="return false;" id="reset-form">
		<label for="password">New Password</label>
		<input class="form-control input-lg" type="password" placeholder="A new password" id="password" /><br />
		<label for="repeat">Confirm Password</label>
		<input class="form-control input-lg" type="password" placeholder="The same password" id="repeat" /><br />
		<button class="btn btn-primary btn-lg btn-block" id="reset" type="submit" disabled>Reset Password</button>
	</form>
</div>
<input type="hidden" template-variable="reset_code" value="{reset_code}" />
