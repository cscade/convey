/*
	# Convey

	Created by Carson S. Christian <cscade@gmail.com>

	A CouchDB design babysitter and automated document converter. Automate document changes along side your application version.
*/

var async = require('async'),
	events = require('events'),
	path = require('path'),
	semver = require('semver'),
	util = require('util');

/*
	## Constructor.
	
	Create a new `convey` instance.
*/
var Convey = function () {
	events.EventEmitter.call(this);
};
util.inherits(Convey, events.EventEmitter);

/*
	## check
	
	Check the databases as specified by the configuration file.
	
	@param {mixed} couch The connection information for nano. Anything you could normally pass to require('nano')(...)
	@param {String} version The version number to update the database documents to.
	@param {String} config Configuration file location.
*/
Convey.prototype.check = function (couch, version, config) {
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
			database: database,
			resources: resources
		});
		db = nano.db.use(database);
		// Check the status of this database.
		db.get('convey-version', function (e, conveyVersions) {
			if (e && e.reason !== 'missing') return next(e);
			if (e && e.reason === 'missing') {
				// Create a new marker document.
				convey.emit('untouched', database);
				conveyVersions = {
					_id: 'convey-version',
					versions: {}
				};
			}
			// Loop through the resources specified.
			async.forEachSeries(Object.keys(resources), function (name, next) {
				var designDoc = resources[name];
				
				// Determine if updates need to be made.
				if (semver.gte(conveyVersions.versions[name] || '0.0.0', version)) {
					convey.emit('resource:fresh', name);
					return next();
				}
				convey.emit('resource:stale', name);
				// Read the design doc from disk.
				try {
					designDoc = require(path.join(__dirname, '..', designDoc));
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
						if (!designDoc.convey) return next();
						// ...
						next();
					}
				}, function (e) {
					if (e) return next(e);
					convey.emit('resource:updated', name);
					conveyVersions.versions[name] = version;
					next();
				});
			}, function (e) {
				if (e) return next(e);
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
	var fs = require('fs');
	
	// Load up the configuration file.
	try {
		this.config = JSON.parse(fs.readFileSync(config, 'utf-8'));
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
