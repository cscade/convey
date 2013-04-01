/*jshint couch:true */
// Updates to convey.
exports.convey = function (doc, next) {
	var newDoc;
	
	// Update all the `thing` documents with a new property.
	if (doc.resource !== 'thing') return next();
	doc.foo = 'bar';
	// Create a new document for each `thing` document as well.
	newDoc = {
		resource: 'relatedThing',
		relatesTo: doc._id
	};
	// 
	next(doc, newDoc);
};
// Design to publish.
exports.design = {
	_id:"_design/single",
	language: "javascript",
	views: {
		allTheRelatedThings: {
			map: function (doc) {
				if (doc.resource === 'relatedThing') {
					emit(doc.relatesTo, null);
				}
			}
		}
	}
};