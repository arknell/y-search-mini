/**
 * 웹 관리자 로그인용 컨트롤러
 * 기본 생성
 */
'use strict';

var _express = require('express');

var _user = require('./user.controller');

var controller = _interopRequireWildcard(_user);

var _auth = require('../../components/auth/auth.service');

var auth = _interopRequireWildcard(_auth);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var router = new _express.Router();
router.all('/*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

router.post('/sign/in', controller.signIn); // 로그 인
router.post('/sign/out', controller.signOut); // 로그 아웃
router.post('/me', auth.isAuthenticated(), controller.me); // 로그인 정보

module.exports = router;
//# sourceMappingURL=index.js.map
