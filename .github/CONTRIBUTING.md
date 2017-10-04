# Submitting a Pull Request to NodeBB?

First of all, thank you! Before submission, please run `npm test` to lint and run the automated NodeBB tests. If everything passes, you're good to go. If you have any errors, please fix them and re-run `npm test` to make sure there aren't any others.

## Styleguide and linting

NodeBB mostly conforms to the [AirBnB Javascript style guide](https://github.com/airbnb/javascript#readme). If you're running into a lot of ESlint errors, you may want to install an editor plugin to display them in real time.

## Contributor License Agreement

Thank you for considering contributing to NodeBB. **Before you are able to submit a pull request, please take a moment to read our [contributor license agreement](https://gist.github.com/psychobunny/65946d7aa8854b12fab9)** and agree to it on the pull request page on GitHub. In summary, signing this document means that 1) you own the code that you are contributing and 2) you give permission to NodeBB Inc. to license the code to others. This agreement applies to any repository under the NodeBB organization.

If you are writing contributions as part of employment from another company / individual, then your employer will need to sign a separate agreement. Please [contact us](mailto:accounts@nodebb.org) so that we can send this additional agreement to your employer.


# Having problems installing NodeBB?

Chances are somebody has run into this problem before. After consulting our [documentation](https://docs.nodebb.org/installing/os/), please head over to our [community support forum](https://community.nodebb.org) for advice.

# Found a Security Vulnerability?

If you believe you have identified a security vulnerability with NodeBB, report it as soon as possible via email to **security@nodebb.org**.
A member of the NodeBB security team will respond to the issue.
Please do not post it to the public bug tracker.

# Issues & Bugs

Thanks for reporting an issue with NodeBB! Please follow these guidelines in order to streamline the debugging process. The more guidelines you follow, the easier it will be for us to reproduce your problem.

In general, if we can't reproduce it, we can't fix it!

## Try the latest version of NodeBB

There is a chance that the issue you are experiencing may have already been fixed.

## Provide the NodeBB version number and git hash

You can find the NodeBB version number in the Admin Control Panel (ACP), as well as the first line output to the shell when running NodeBB

``` plaintext
3/4 12:38:57 [10752] - info: NodeBB v1.4.5 Copyright (C) 2013-2017 NodeBB Inc.
3/4 12:38:57 [10752] - info: This program comes with ABSOLUTELY NO WARRANTY.
3/4 12:38:57 [10752] - info: This is free software, and you are welcome to redistribute it under certain conditions.
```

If you are running NodeBB via git, it is also helpful to let the maintainers know what commit hash you are on. To find the commit hash, execute the following command:

``` bash
$ cd /path/to/my/nodebb
$ git rev-parse HEAD
```

If you have downloaded the `.zip` or `.tar.gz` packages from GitHub (or elsewhere), please let us know.

## Provide theme versions if issue is related to the theme/display
Use `npm ls` to list the versions of the theme you're using. In this example, we're running the Persona theme, which depends on the Vanilla theme.

``` bash
$ npm ls nodebb-theme-vanilla nodebb-theme-persona
nodebb@1.4.3 /path/to/nodebb
+-- nodebb-theme-persona@4.2.4
`-- nodebb-theme-vanilla@5.2.0
```

## Attempt to use `git bisect`

If you have installed NodeBB via GitHub clone, are familiar with utilising git, and are willing to help us narrow down the specific commit that causes a bug, consider running `git bisect`.

A full guide can be found here: [Debugging with Git/Binary Search](http://git-scm.com/book/en/Git-Tools-Debugging-with-Git#Binary-Search)
