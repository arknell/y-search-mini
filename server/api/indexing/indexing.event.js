/**
 * 색인 이벤트
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _events = require('events');

var IndexingEvents = new _events.EventEmitter();

// Set max event listeners (0 == unlimited)
IndexingEvents.setMaxListeners(0);

IndexingEvents.call = function (event, msg) {
  console.log('Indexing Event ', event, msg);
  IndexingEvents.emit(event, msg);
};

exports.default = IndexingEvents;
//# sourceMappingURL=indexing.event.js.map
