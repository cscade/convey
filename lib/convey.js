/*
	# Convey

	Created by Carson S. Christian <cscade@gmail.com>

	A CouchDB design babysitter and automated document converter. Automate document changes along side your application version.
*/

var async = require('async'),
	events = require('events'),
	path = require('path'),
	semver = require('semver'),
	util = require('util'),
	extend = require('xtend');

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
	@param {String} config Configuration file location.
	@param {Boolean} [force] Force all updates to run, regardless of version checks.
*/
Convey.prototype.check = function (couch, version, config, force) {
	var nano = require('nano')(couch),
		convey = this;
	
	// Set up configuration.
	this.configure(config);
	// Start looking at the databases configured for checking.
	this.emit('start', {
		couch: couch,
		version: version,
		config: this.config
	});
	async.forEachSeries(Object.keys(this.config), function (database, next) {
		var db, resources = convey.config[database];
		
		convey.emit('database:start', {
			database: database
		});
		db = nano.db.use(database);
		// Check the status of this database.
		db.get('convey-version', function (e, conveyVersions) {
			if (e && e.reason !== 'missing' && e.reason !== 'deleted') return next(e);
			if (e && (e.reason === 'missing' || e.reason === 'deleted')) {
				// Create a new marker document.
				convey.emit('untouched', {
					database: database
				});
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
						database: database,
						resource: name
					});
					return next();
				}
				convey.emit('resource:stale', {
					database: database,
					resource: name,
					forced: force
				});
				// Read the design doc from disk.
				try {
					designDoc = require(path.join(process.cwd(), designDoc));
				} catch (e) {
					return next(e);
				}
				async.series({
					// Publish new design doc.
					design: function (next) {
						if (!designDoc.design) return next();
						convey.publish(db, designDoc.design, next);
					},
					// Update database docs.
					updateDocs: function (next) {
						var updates = 0, creates = 0;
						
						if (!designDoc.convey) return next(null, {
							updates: updates,
							creates: creates
						});
						db.list(function (e, body) {
							if (e) return next(e);
							async.forEachSeries(body.rows, function (row, next) {
								db.get(row.id, function (e, doc) {
									if (e) return next(e);
									designDoc.convey(doc, function (edited, create) {
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
					}
				}, function (e, results) {
					if (e) return next(e);
					convey.emit('resource:updated', {
						database: database,
						resource: name,
						updated: results.updateDocs.updates,
						created: results.updateDocs.creates
					});
					conveyVersions.versions[name] = version;
					next();
				});
			}, function (e) {
				if (e) return next(e);
				// Extend `convey-version` document with userland properties if provided.
				if (convey.options.extendDocument) conveyVersions = extend(convey.options.extendDocument, conveyVersions);
				// Save `convey-version` document.
				db.insert(conveyVersions, function (e) {
					if (e) return next(e);
					convey.emit('database:done', {
						database: database,
						resources: resources
					});
					next();
				});
			});
		});
	}, function (e) {
		if (e) return convey.emit('error', e);
		convey.emit('done');
	});
};

/*
	## configure (private)
	
	Specify the configuration file to use.
	
	@param {String} config Configuration file location.
*/
Convey.prototype.configure = function (config) {
	// Load up the configuration file.
	try {
		this.config = require(config);
	} catch (e) {
		return this.emit('error', new Error('configuration file could not be loaded/parsed. ensure a valid JSON config file. - ' + config));
	}
};

/*
	## publish

	Publish a design to a database, updating the existing design if needed.

	@param {Object} db `nano` db instance
	@param {Object} design
	@param {Function} done
*/
Convey.prototype.publish = function (db, design, done) {
	db.insert(design, function (e) {
		if (e && e.status_code === 409) {
			// Conflict, update.
			db.head(design._id, function (e, body, headers) {
				if (e) return done(e);
				design._rev = headers.etag.slice(1, -1); // etags are quoted strings
				db.insert(design, done);
			});
		} else {
			done(e);
		}
	});
};


// Expose.
module.exports = Convey;
