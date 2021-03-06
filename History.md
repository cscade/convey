## 1.1.0 2013-09-17

* added
	* `done` event contains new `ms` property, for milliseconds of execution time
	* an error event will be generated if the application version number provided to `check()` is not a valid semver

## 1.0.0 - 2013-08-19

* changed
	* missing target databases will no longer cause an error to be emitted or returned
* added
	* new event `database:missing` fired when a target database does not exist

## 0.2.2 - 2013-05-03

* fix _rev being added to design documents at design update time. closes #1

## 0.2.1 - 2013-04-05

* accept a callback on check(), making event listeners entirely optional

## 0.2.0 - 2013-04-03

This release may break logging handlers on events, as some information emitted has changed.

* refactor some nested methods
* remove database:untouched event
* remove `database` property from resource level events
* move create/edit statistics into new target:done event
* support deriving target databases from views

## 0.1.1 - 2013-04-01

* look up config files relative to `process.cwd()`
* change event names to be more consitent
* expose execution time in `done` event

## 0.1.0 - 2013-04-01

* intial functioning release
