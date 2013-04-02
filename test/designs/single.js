/*jshint couch:true */
// Updates to convey.
exports.convey = function (doc, next) {
	next();
};
// Design to publish.
exports.design = {
	_id:"_design/single",
	language: "javascript",
	views: {
		allTheThings: {
			map: function (doc) {
				if (doc.resource === 'thing') {
					emit(doc._id, null);
				}
			}
		}
	}
};