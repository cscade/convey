/*
	# Gruntfile
*/

module.exports = function (grunt) {
	grunt.initConfig({
		// Code quality.
		jshint: {
			options: {
				eqeqeq: true,
				immed: true,
				latedef: true,
				newcap: true,
				noarg: true,
				undef: true,
				// Relax.
				boss: true,
				smarttabs: true,
				node: true
			},
			grunt: [
				'Gruntfile.js'
			],
			convey: [
				'index.js'
			]
		},
		// Watch.
		watch: {
			jshint: {
				files: [
					'index.js'
				],
				tasks: ['jshint:convey']
			}
		}
	});
	
	// Dependecies.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	
	// Tasks.
	grunt.registerTask('default', ['jshint:grunt', 'jshint:convey']);
};
