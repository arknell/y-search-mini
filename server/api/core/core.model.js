/**
 * data model을 위해 자동 생성된 파일. 사용하지 않음. 이하 동일
 */
'use strict';

var ldb = require('../../components/commons/ldb');
var coredb = ldb.open('core');

modeule.exports = {
    close: coredb.close,
    put: function put(key, val) {
        coredb.put(key, val, {
            keyEncoding: 'binary',
            valueEncoding: 'json'
        });
    }
};
//# sourceMappingURL=core.model.js.map
