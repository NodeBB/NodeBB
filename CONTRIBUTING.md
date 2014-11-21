# Having problems installing NodeBB?

Chances are somebody has run into this problem before. After consulting our [documentation](https://docs.nodebb.org/en/latest/installing/os.html), please head over to our [community support forum](https://community.nodebb.org) for advice.


# Issues & Bugs

Thanks for reporting an issue with NodeBB! Please follow these guidelines in order to streamline the debugging process. The more guidelines you follow, the easier it will be for us to reproduce your problem.

In general, if we can't reproduce it, we can't fix it!

> #### **Important**
> If you believe you have identified a security vulnerability with NodeBB, report it as soon as possible via email to **security@nodebb.org**.
> A member of the NodeBB security team will respond to the issue.
> Please do not post it to the public bug tracker.

## Try the latest version of NodeBB

There is a chance that the issue you are experiencing may have already been fixed.

## Provide the NodeBB version number and git hash

You can find the NodeBB version number in the Admin Control Panel (ACP), as well as the first line output to the shell when running NodeBB

``` plaintext
info: NodeBB v0.5.2-dev Copyright (C) 2013-2014 NodeBB Inc.
info: This program comes with ABSOLUTELY NO WARRANTY.
info: This is free software, and you are welcome to redistribute it under certain conditions.
info: 
info: Time: Tue Oct 07 2014 20:25:20 GMT-0400 (EDT)
```

If you are running NodeBB via git, it is also helpful to let the maintainers know what commit hash you are on. To find the commit hash, execute the following command:

``` bash
$ cd /path/to/my/nodebb
$ git rev-parse HEAD
```

If you have downloaded the `.zip` or `.tar.gz` packages from GitHub (or elsewhere), please let us know.

## Attempt to use `git bisect`

If you have installed NodeBB via GitHub clone, are familiar with utilising git, and are willing to help us narrow down the specific commit that causes a bug, consider running `git bisect`.

A full guide can be found here: [Debugging with Git/Binary Search](http://git-scm.com/book/en/Git-Tools-Debugging-with-Git#Binary-Search)