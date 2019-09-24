/**
 * 색인 Socket.IO
 * 설정(config/socketio.js)에서 이 파일을 등록해서 사용함
 * Broadcast updates to client when the model changes
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.register = register;

var _indexing = require('./indexing.event');

var _indexing2 = _interopRequireDefault(_indexing);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Model events to emit
var events = ['save', 'remove', 'update']; // 상태 들

// 소켓 등록
function register(socket) {
    // Bind model events to socket events
    for (var i = 0, eventsLength = events.length; i < eventsLength; i++) {
        var event = events[i];
        var listener = createListener('indexing:' + event, socket);

        _indexing2.default.on(event, listener);
        socket.on('disconnect', removeListener(event, listener));
    }
}

// listener 등록
function createListener(event, socket) {
    return function (doc) {
        socket.emit(event, doc); // 메시지 전송
    };
}

// listener 삭제
function removeListener(event, listener) {
    return function () {
        _indexing2.default.removeListener(event, listener);
    };
}
//# sourceMappingURL=indexing.socket.js.map
