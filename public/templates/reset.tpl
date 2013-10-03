<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">Reset Password</span>
	</li>
</ol>

<div class="alert alert-info">
			Please enter your <strong>email address</strong> and we will send you an email with instructions on how to reset your account.
		</div>
<div class="well">
	<div class="alert alert-success" id="success" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Password Reset Sent</strong>
	</div>
	<div class="alert alert-danger" id="error" style="display:none">
		<button type="button" class="close" data-dismiss="alert">&times;</button>
		<strong>Invalid Email / Email does not exist!</strong>
	</div>
	<form onsubmit="return false;">
		<input type="text" class="form-control input-block input-lg" placeholder="Enter Email Address" id="email" />

		<br />
		<button class="btn btn-primary btn-block btn-lg" id="reset" type="submit">Reset Password</button>
	</form>
</div>
