/**
 * Core Controller
 * 색인 관리 Apis
 * 2018.05.23 batch 전용으로 변경되었음
 */
'use strict';

var _express = require('express');

var _core = require('./core.controller');

var controller = _interopRequireWildcard(_core);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var router = new _express.Router();

router.all('/*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

router.post('/meta', controller.meta);
router.post('/meta/save', controller.metaSave);
router.post('/save', controller.save);
router.get('/info', controller.indexInfo);
router.post('/', controller.index);
router.post('/create', controller.create);
router.post('/init', controller.init);

router.post('/test/connection', controller.testConnection);
router.post('/test/columns', controller.getColumns);

router.post('/index/info', controller.getIndexInfo);

router.post('/remove', controller.remove);

module.exports = router;
//# sourceMappingURL=index.js.map
