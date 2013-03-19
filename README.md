# Convey

[![Build Status](https://travis-ci.org/cscade/convey.png?branch=develop)](https://travis-ci.org/cscade/convey)

The purpose of `convey` is to automate the transition of your app's CouchDB designs and existing documents when your release version changes. Often, a new version of your app will bring with it new features, new validation, document structure changes, etc. One way to handle document structure changes is to perform checks within any code that may use a given document resource, to see what version it is and adjust as needed. While that may work, it rapidly gets messy - and are you sure you got every case everywhere in your app? Furthermore, how will you know when all your documents have been updated and the "upgrade" code is no longer needed?

With convey, you can define arbitrary actions to take place within your CouchDB databases when each new version of your app starts up for the first time in production. This includes document updates, document creation, design publishing, and even the ability to publish to/modify documents in sub-databases defined by views.

## Installation

```
npm install convey
```

## Usage

WIP! Don't use quite yet.