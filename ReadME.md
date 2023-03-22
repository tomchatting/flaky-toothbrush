# Flaky Toothbrush Surge.sh

[![build+deploy](https://github.com/tomchatting/flaky-toothbrush/actions/workflows/surge.yml/badge.svg?branch=main)](https://github.com/tomchatting/flaky-toothbrush/actions/workflows/surge.yml)

[Surge.sh](https://surge.sh) is a wicked simple Static-Site Generator accessible from your shell.

I needed a way to quickly host something I wanted to build which only needed html and js, and didn't want to host it on my website.

This repo simply holds the code, which I commit to main after testing. Once it's deployed, a GitHub action runs (see [.github/workflows/surge.yml](https://github.com/tomchatting/flaky-toothbrush/blob/main/.github/workflows/surge.yml)) tying a couple of Secrets (the domain, and the token) to the command I was running on my Mac manually. Does this really save any time? Probably about 20s. Is that worth it? [You tell me](https://xkcd.com/1319/).

## Projects here

### NHS 1000 Mile Challenge

This was built in a couple of hours on a day off, it ties in to an action and Gist I built really specifically for a single use; so it might not be of any use or learning for anyone. However, if you're a religious Apple Watch user who wants to track their miles ran and walked over a year, with a 1000 mile goal - this'll do great for you.
