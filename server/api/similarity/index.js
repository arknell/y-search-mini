/**
 *
 * @author ChanWoo Kwon
 * date : 2018-05-08
 */

'use strict';

var express = require('express');
var controller = require('./similarity.controller');

var router = express.Router();
router.all('/*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

router.post('/code', controller.code);
router.post('/content', controller.content); // 검색 요청

module.exports = router;
//# sourceMappingURL=index.js.map
