/**
 * 불용어 제거
 */
"use strict";

var fs = require('fs');
var path = require('path');
var stopword = [];

// stopword.dic 에서 불용어 목록을 가져옴
module.exports = function () {
    if (stopword.length < 1) {
        var data = fs.readFileSync(path.normalize(__dirname + '/stopwords.dic'), 'utf8');
        //console.log(data);
        stopword = data.split('\r\n');
    }
    return stopword;
};
//# sourceMappingURL=stopword.js.map
