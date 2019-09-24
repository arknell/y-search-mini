/**
 * 사용자 계정 관련
 * 자동 생성
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/users              ->  index
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.signIn = signIn;
exports.signOut = signOut;
exports.me = me;

var _auth = require('../../components/auth/auth.service');

var auth = _interopRequireWildcard(_auth);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

// 로그인
function signIn(req, res) {
    //res.json([]);
    console.log(req.body.username, req.body.password);
    auth.localAuthenticate(req.body.username, req.body.password, function (err, user, msg) {
        if (!user) {
            return res.status(401).json(msg);
        } else {
            var token = auth.signToken(user.id, user.role);
            return res.json({ token: token });
        }
    });
}

// 로그아웃
function signOut(req, res) {
    res.json([]);
}

// 로그인 된 사용자 정보
function me(req, res) {
    res.json(req.user).end();

    /*return User.find({
        where: {
            _id: userId
        },
        attributes: [
            '_id',
            'name',
            'email',
            'role',
            'provider'
        ]
    })
        .then(user => { // don't ever give out the password or salt
            if (!user) {
                return res.status(401).end();
            }
            return res.json(user).end();
        })
        .catch(err => { next(err) });*/
}
//# sourceMappingURL=user.controller.js.map
