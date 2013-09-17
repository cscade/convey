/*
	# Convey

	Created by Carson S. Christian <cscade@gmail.com>

	A CouchDB design babysitter and automated document converter. Automate document changes along side your application version.
*/

var async = require('async');
var events = require('events');
var path = require('path');
var semver = require('semver');
var util = require('util');
var extend = require('xtend');

/*
	## Constructor.
	
	Create a new `convey` instance.
	
	@param {Object} [options]
	@param {Object} [options.extendDocument] An object that will extend the `convey-version` document saved in each database.
*/
var Convey = function (options) {
	events.EventEmitter.call(this);
	// Options support.
	this.options = options || {};
};
util.inherits(Convey, events.EventEmitter);

/*
	## check
	
	Check the databases as specified by the configuration file.
	
	@param {mixed} couch The connection information for nano. Anything you could normally pass to require('nano')(...)
	@param {String} version The version number to update the database documents to.
	@param {String} config Configuration file location, relative to process.cwd().
	@param {Boolean} [force] Force all updates to run, regardless of version checks.
	@param {Function} [done(err)] Callback after execution is complete.
*/
Convey.prototype.check = function (couch, version, config, force, done) {
	var nano = require('nano')(couch),
		start = process.hrtime(),
		convey = this;
	
	// Parse arguments.
	if (typeof force === 'function') {
		done = force;
		force = false;
	}
	// Set up configuration.
	try {
		this.config = require(path.join(process.cwd(), config));
	} catch (e) {
		return this.handleError(e, done);
	}
	// Start looking at the databases configured for checking.
	this.emit('start', {
		couch: couch,
		version: version,
		config: this.config
	});
	async.forEachSeries(Object.keys(this.config), function (database, next) {
		var db, resources = convey.config[database], targetDbs;
		
		convey.emit('database:start', {
			database: database
		});
		db = nano.db.use(database);
		// Check the status of this database.
		db.get('convey-version', function (e, conveyVersions) {
			if (e && e.reason !== 'missing' && e.reason !== 'deleted') return next(e);
			if (e && (e.reason === 'missing' || e.reason === 'deleted')) {
				// Create a new marker document.
				conveyVersions = {
					_id: 'convey-version',
					versions: {}
				};
			}
			// Loop through the resources specified.
			async.forEachSeries(Object.keys(resources), function (name, next) {
				var designDoc = resources[name];
				
				// Determine if updates need to be made.
				if (semver.gte(conveyVersions.versions[name] || '0.0.0', version) && !force) {
					convey.emit('resource:fresh', {
						resource: name
					});
					return next();
				}
				convey.emit('resource:stale', {
					resource: name,
					forced: force
				});
				async.series({
					/*
						Single target database configuration.
					
						designDoc will be a `String`.
					*/
					singleDb: function (next) {
						if (typeof designDoc === 'object') return next();
						targetDbs = [{
							db: db,
							target: database,
							design: designDoc
						}];
						next();
					},
					/*
						Multiple target database configuration.
					
						designDoc will be an `Object`.
					*/
					multiDb: function (next) {
						if (typeof designDoc === 'string') return next();
						// Get target dbs from specified view.
						targetDbs = [];
						db.view(designDoc.view.split('/')[0], designDoc.view.split('/')[1], function (e, body) {
							if (e) return next(e);
							body.rows.forEach(function (row) {
								targetDbs.push({
									db: nano.db.use(row.value), // Target db names are the `value` property of the rows.
									target: row.value,
									design: designDoc.assets
								});
							});
							next();
						});
					}
				}, function (e) {
					if (e) return next(e);
					async.forEachSeries(targetDbs, function (targetDb, next) {
						var doc;
						
						// Require the design document.
						try {
							doc = require(path.join(process.cwd(), targetDb.design));
						} catch (e) {
							return next(e);
						}
						async.series({
							// Publish new design doc.
							design: function (next) {
								if (!doc.design) return next();
								convey.publish(targetDb.db, doc.design, next);
							},
							// Edit/create database docs.
							update: function (next) {
								if (!doc.convey) return next(null, {
									updates: 0,
									creates: 0
								});
								convey.update(targetDb.db, doc.convey, next);
							}
						}, function (e, results) {
							if (e) return next(e);
							convey.emit('target:done', {
								database: targetDb.target,
								updated: results.update.updates,
								created: results.update.creates
							});
							next();
						});
					}, function (e) {
						if (e) return next(e);
						convey.emit('resource:done', {
							resource: name
						});
						conveyVersions.versions[name] = version;
						next();
					});
				});
			}, function (e) {
				if (e) return next(e);
				// Extend `convey-version` document with userland properties if provided.
				if (convey.options.extendDocument) conveyVersions = extend(convey.options.extendDocument, conveyVersions);
				// Save `convey-version` document.
				db.insert(conveyVersions, function (e) {
					if (e) return next(e);
					convey.emit('database:done', {
						database: database
					});
					next();
				});
			});
		});
	}, function (e) {
		var diff;
		
		if (e) return convey.handleError(e, done);
		diff = process.hrtime(start);
		convey.emit('done', {
			duration: diff[0],
			ms: Math.floor((diff[0] * 1e9 + diff[1]) / 1e6)
		});
		if (done) done();
	});
};

/*
	## handleError

	Handle an error. Errors are emitted if there is no callback to `check`,
	otherwise they are only called back.

	@param {Error} e
	@param {Function} [callback]
*/
Convey.prototype.handleError = function (e, callback) {
	// Emit errors only if there is no callback.
	if (!callback) return this.emit('error', e);
	callback(e);
};


/*
	## publish

	Publish a design to a database, updating the existing design if needed.

	@param {Object} db `nano` db instance
	@param {Object} design
	@param {Function} done

	@api public
*/
Convey.prototype.publish = function (db, design, done) {
	var convey = this;
	
	db.insert(design, function (e) {
		if (e && e.status_code === 404) {
			convey.emit('database:missing', {
				database: db.config.db
			});
			return done();
		}
		if (e && e.status_code === 409) {
			// Conflict, update.
			db.head(design._id, function (e, body, headers) {
				if (e) return done(e);
				design._rev = headers.etag.slice(1, -1); // etags are quoted strings
				db.insert(design, function (e) {
					delete design._rev;
					done(e);
				});
			});
		} else {
			done(e);
		}
	});
};

/*
	## update

	Pass all documents in db through the edit/create method.

	@param {Object} db Nano db instance.
	@param {Function} editor Edit/Create method.
	@param {Function} next

	@api private
*/
Convey.prototype.update = function (db, editor, next) {
	var convey = this;
	var updates = 0, creates = 0;
	
	db.list(function (e, body) {
		if (e && e.status_code === 404) {
			convey.emit('database:missing', {
				database: db.config.db
			});
			return next(null, {
				updates: 0,
				creates: 0
			});
		}
		if (e) return next(e);
		async.forEachSeries(body.rows, function (row, next) {
			db.get(row.id, function (e, doc) {
				if (e) return next(e);
				editor(doc, function (edited, create) {
					async.series({
						/*
							Save edited document.
						*/
						edited: function (next) {
							if (!edited) return next();
							db.insert(edited, function (e) {
								if (e) return next(e);
								updates++;
								next();
							});
						},
						/*
							Create new document.
						*/
						create: function (next) {
							if (!create) return next();
							db.insert(create, function (e) {
								if (e) return next(e);
								creates++;
								next();
							});
						}
					}, next);
				});
			});
		}, function (e) {
			if (e) return next(e);
			next(null, {
				updates: updates,
				creates: creates
			});
		});
	});
};


// Expose.
module.exports = Convey;
