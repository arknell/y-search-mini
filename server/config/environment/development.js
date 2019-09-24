'use strict';

// Development specific configuration
// ==================================

module.exports = {
	port: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8070,
	indexer: {
		quizpath: 'Z:\\Earlgae2014\\'
	},
	users: [{ id: 'admin', pw: 'pass', role: 'admin' }],
	// Seed database on startup
	synonymsUrl: 'http://218.144.101.99:8801' + '/api/words/synonyms',
	idbUrl: 'localhost',
	idbPort: 27017,
	idbPw: "iosys1234",
	idbId: "search_engine",
	apiurl: "http://localhost:8080/earlgae-serv",
	scheduleTime: "12 * * * *"
};
//# sourceMappingURL=development.js.map
