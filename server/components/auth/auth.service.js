/**
 * 웹 사용자 계정 관련 Service
 * 기본 생성된 내용
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.localAuthenticate = localAuthenticate;
exports.isAuthenticated = isAuthenticated;
exports.signToken = signToken;
exports.setTokenCookie = setTokenCookie;

var _environment = require('../../config/environment');

var _environment2 = _interopRequireDefault(_environment);

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _expressJwt = require('express-jwt');

var _expressJwt2 = _interopRequireDefault(_expressJwt);

var _composableMiddleware = require('composable-middleware');

var _composableMiddleware2 = _interopRequireDefault(_composableMiddleware);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var validateJwt = (0, _expressJwt2.default)({
	secret: _environment2.default.secrets.session
});

var users = _environment2.default.users;

function findUser(id) {

	return _lodash2.default.find(users, { 'id': id });
}

// 웹 사용자 로그인
function localAuthenticate(name, password, done) {
	var user = findUser(name);
	if (!user) {
		done(null, false, {
			message: 'This username is not registered.'
		});
		return;
	}

	console.log(user);

	if (user.pw === password) {
		done(null, _lodash2.default.omit(user, 'pw'));
	} else {
		done(null, false, {
			message: 'This password is not correct.'
		});
	}
}

/**
 * Attaches the user object to the request if authenticated
 * Otherwise returns 403
 */
function isAuthenticated() {
	return (0, _composableMiddleware2.default)()
	// Validate jwt
	.use(function (req, res, next) {
		// allow access_token to be passed through query parameter as well
		if (req.body && req.body.hasOwnProperty('access_token')) {
			req.headers.authorization = 'Bearer ' + req.body.access_token;
		}
		validateJwt(req, res, next);
	})
	// Attach user to request
	.use(function (req, res, next) {

		//console.log(req.user);
		var user = findUser(req.user._id);
		if (!user) {
			return res.status(401).end();
		}
		req.user = _lodash2.default.omit(user, 'pw');
		next();
	});
}

/**
 * Checks if the user role meets the minimum requirements of the route
 */
/*export function hasRole(roleRequired) {
    if (!roleRequired) {
        throw new Error('Required role needs to be set');
    }

    return compose()
        .use(isAuthenticated())
        .use(function meetsRequirements(req, res, next) {
            if (config.userRoles.indexOf(req.user.role) >=
                config.userRoles.indexOf(roleRequired)) {
                next();
            } else {
                res.status(403).send('Forbidden');
            }
        });
}*/

/**
 * Returns a jwt token signed by the app secret
 * 로그인 토근 및 세션 유지 시간 -
 */
function signToken(id, role) {
	return _jsonwebtoken2.default.sign({ _id: id, role: role }, _environment2.default.secrets.session, {
		expiresIn: 60 * 60 * 48 //(48시간) //인덱싱이 상당히 오래걸릴 수 있음
	});
}

/**
 * Set token cookie directly for oAuth strategies
 */
function setTokenCookie(req, res) {
	if (!req.user) {
		return res.status(404).send('It looks like you aren\'t logged in, please try again.');
	}
	var token = signToken(req.user._id, req.user.role);
	res.cookie('token', token);
	res.redirect('/');
}
//# sourceMappingURL=auth.service.js.map
