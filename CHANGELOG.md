### 1.11.0 (2018-11-28)

##### Chores

* **deps:**
  *  update dependency lint-staged to v8.1.0 (dd7f8a14)
  *  update dependency husky to v1.2.0 (aee21628)
  *  update node:8.12.0 docker digest to 5dae8ea (0ef451dd)
  *  update dependency husky to v1.1.4 (95d6ab06)
  *  update dependency eslint to v5.9.0 (92441794)
  *  pin dependencies (b0483f21)
  *  update dependency eslint-config-airbnb-base to v13 (#6599) (64b9dabf)
  *  update node.js to v8.12.0 (fa3afbd2)
  *  update dependency husky to v1.1.3 (6cee5b8e)
  *  update dependency lint-staged to v8.0.4 (9d258668)
  *  update dependency lint-staged to v8.0.3 (aaa6fe9e)
  *  update dependency lint-staged to v8 (95d7a5fa)
  *  update dependency jsdom to v13 (52f141c9)
* **husky:**  setting up husky as recommended in docs (e8a3d929)

##### New Features

*  enabling commitlint (c58a41ed)
*  allow disabling of GDPR features via ACP toggle, closes #6847 (4919e9ef)

##### Bug Fixes

* **deps:**
  *  update dependency nodebb-theme-vanilla to v10.1.12 (cf928f44)
  *  update dependency nodebb-theme-persona to v9.1.0 (179be9ed)
  *  update dependency nodebb-theme-persona to v9.0.63 (#7019) (68ae3eb6)
  *  update dependency nodebb-plugin-markdown to v8.8.5 (d3ab7d1b)
  *  update dependency nodebb-theme-persona to v9.0.60 (#6984) (cbd50a80)
  *  update dependency nodebb-theme-vanilla to v10.1.10 (#6982) (4c769487)
  *  update dependency nodebb-theme-slick to v1.2.15 (#6981) (acaf1a05)
  *  update dependency nodebb-theme-persona to v9.0.59 (#6980) (5863bb2c)
  *  update dependency lru-cache to v4.1.4 (#6977) (375ab769)
  *  update dependency connect-mongo to v2.0.2 (#6975) (e1597b83)
  *  update dependency nodebb-plugin-markdown to v8.8.4 (84d1013d)
  *  update dependency nodebb-plugin-composer-default to v6.1.8 (fee7e336)
  *  update dependency nodebb-plugin-markdown to v8.8.3 (b182a195)
  *  update dependency nodebb-plugin-composer-default to v6.1.7 (#6966) (1101f327)
  *  update dependency nodebb-theme-persona to v9.0.58 (#6964) (6ade156b)
  *  update dependency mongodb to v3.1.10 (#6962) (662215fa)
  *  update dependency nodebb-theme-persona to v9.0.57 (#6956) (1bf1a439)
  *  update dependency nodebb-theme-persona to v9.0.55 (#6955) (e06683f7)
  *  update dependency nodebb-plugin-composer-default to v6.1.6 (c51ceaf0)
  *  update dependency nodebb-theme-persona to v9.0.54 (bb940b01)
  *  update dependency nodebb-plugin-mentions to v2.2.12 (#6936) (e12a803b)
  *  update dependency nodebb-theme-vanilla to v10.1.9 (#6935) (b480c321)
  *  update dependency nodebb-theme-slick to v1.2.14 (#6934) (9cdd5316)
  *  update dependency nodebb-theme-persona to v9.0.53 (#6933) (9ee1c2f8)
  *  update dependency nodebb-plugin-dbsearch to v2.0.23 (#6931) (dba1db9c)
  *  update dependency jsesc to v2.5.2 (511b4edc)
  *  update dependency validator to v10.9.0 (032caafa)
  *  update dependency spdx-license-list to v5 (a639b6b8)
  *  update dependency nodebb-theme-vanilla to v10.1.8 (eb0a322d)
  *  update dependency nodebb-theme-persona to v9.0.52 (6566a0cb)
  *  update dependency nodebb-plugin-dbsearch to v2.0.22 (#6916) (7808e58c)
  *  update dependency mongodb to v3.1.9 (#6914) (9a9f2af9)
  *  update dependency nodebb-theme-persona to v9.0.51 (e2274fe0)
  *  update dependency nodebb-theme-slick to v1.2.13 (3005428d)
  *  update dependency nodebb-theme-persona to v9.0.50 (#6902) (22140a20)
  *  update dependency nodebb-plugin-markdown to v8.8.2 (0b4c9a80)
  *  update dependency nodebb-theme-vanilla to v10.1.7 (3150a2fc)
  *  update dependency nodebb-theme-slick to v1.2.12 (#6881) (9bcda7f7)
  *  update dependency nodebb-theme-persona to v9.0.49 (#6880) (e0dc00da)
  *  update dependency nodebb-theme-persona to v9.0.48 (2b6f5eec)
*  added admin/manage/uploads to tx config (7357926f)
*  #7013, add cache buster to js-enabled.css (f6b92c1d)
*  removal of scroll anchoring code in favour of browser handling (98c14e0e)
*  custom navigation item not showing groups (d9452bf3)
*  flags detail page crash if reporter blocks author (d027207f)
*  #6922, skin assets not including plugin LESS files (a5022ce4)
*  #6921, allow square brackets in usernames (da10ca08)
*  interstitial redirects failing if done via ajaxify (3c8939a8)
*  username trim on login, closes #6894 (157bea69)
* **uploads:**  ugly filenames on uploaded asset downloading (f96208a0)
* **acp:**
  *  small UI fixes for ACP privileges category selector (#6946) (57b39d5b)
  *  hard-to-discover dropdown selector in ACP (b3f96d28)
* **l10n:**  some translations (34cbd1fc)

##### Code Style Changes

* **eslint:**
  *  newlines in public/src as well (f7bd398e)
  *  enforcing newline on chained calls (95cc27f1)

