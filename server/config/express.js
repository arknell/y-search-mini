/**
 * Express configuration
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

exports.default = function (app) {
	var env = app.get('env');
	//app.use(compression());
	app.use(_bodyParser2.default.urlencoded({ extended: false }));
	app.use(_bodyParser2.default.json());
	app.use((0, _methodOverride2.default)());
	app.use((0, _cookieParser2.default)());

	// Persist sessions with MongoStore / sequelizeStore
	// We need to enable sessions for passport-twitter because it's an
	// oauth 1.0 strategy, and Lusca depends on sessions
	app.use((0, _expressSession2.default)({
		secret: _environment2.default.secrets.session,
		saveUninitialized: true,
		resave: false
	}));

	/**
  * Lusca - express server security
  * https://github.com/krakenjs/lusca
  */
	if (env !== 'test' && !process.env.SAUCE_USERNAME) {
		app.use(conditionalCSRF); // for external API
	}

	if ('development' === env) {
		app.use(require('connect-livereload')({
			ignore: [/^\/api\/(.*)/, /\.js(\?.*)?$/, /\.css(\?.*)?$/, /\.svg(\?.*)?$/, /\.ico(\?.*)?$/, /\.woff(\?.*)?$/, /\.png(\?.*)?$/, /\.jpg(\?.*)?$/, /\.jpeg(\?.*)?$/, /\.gif(\?.*)?$/, /\.pdf(\?.*)?$/]
		}));
	}

	if ('development' === env || 'test' === env) {
		app.use((0, _errorhandler2.default)()); // Error handler - has to be last
	}

	// 외부에서 호출 가능한 APIs
	var truePath = ['/api/users/sign/in', '/api/users/sign/out', '/api/users/me', '/api/searchs', '/api/indexings/indexing', '/api/indexings/one', '/api/indexings/content', '/api/indexings/math', '/api/indexings/remove', '/api/indexings/modify', '/api/indexings/getTotal', '/api/indexings/copy', '/api/indexings/updateColumn', '/api/indexings/removeAll', '/api/indexings/checkKey', '/api/similarity/code', '/api/similarity/content', '/api/cores', '/api/cores/meta', '/api/cores/meta/save', '/api/cores/save', '/api/cores/remove', '/api/cores/create', '/api/words', '/api/words/all', '/api/words/search'];

	/**
  * Lusca - express server security
  * https://github.com/krakenjs/lusca
  */
	function conditionalCSRF(req, res, next) {

		if (truePath.indexOf(req.path) > -1) {
			console.log('req.path', req.path);
			next();
		} else {
			try {
				(0, _lusca2.default)({
					csrf: {
						angular: true
					},
					xframe: 'SAMEORIGIN',
					hsts: {
						maxAge: 31536000, //1 year, in seconds
						includeSubDomains: true,
						preload: true
					},
					xssProtection: true
				})(req, res, next);
			} catch (e) {
				console.error(e);
			}
		}
	}
};

var _bodyParser = require('body-parser');

var _bodyParser2 = _interopRequireDefault(_bodyParser);

var _methodOverride = require('method-override');

var _methodOverride2 = _interopRequireDefault(_methodOverride);

var _cookieParser = require('cookie-parser');

var _cookieParser2 = _interopRequireDefault(_cookieParser);

var _errorhandler = require('errorhandler');

var _errorhandler2 = _interopRequireDefault(_errorhandler);

var _lusca = require('lusca');

var _lusca2 = _interopRequireDefault(_lusca);

var _environment = require('./environment');

var _environment2 = _interopRequireDefault(_environment);

var _expressSession = require('express-session');

var _expressSession2 = _interopRequireDefault(_expressSession);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=express.js.map
