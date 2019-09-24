'use strict';

// Production specific configuration
// =================================

module.exports = {
    // Server IP
    ip: process.env.OPENSHIFT_NODEJS_IP || process.env.IP || undefined,
    // Server port
    port: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8060,
    indexer: {
        quizpath: ''
    },
    users: [{ id: 'admin', pw: 'qwer!@34', role: 'admin' }],
    // Seed database on startup
    synonymsUrl: 'http://node.teams.kr:8800' + '/api/words/synonyms',
    idbUrl: 'node.earlgae.net',
    idbPort: 27017,
    idbPw: "iosys1234",
    idbId: "search_engine",
    apiurl: "http://www.earlgae.net:8080/earlgae-serv",
    scheduleTime: "0 2 * * *"
};
//# sourceMappingURL=production.js.map
