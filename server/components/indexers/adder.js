'use strict';

/**
 * 색인 DB에 추가
 * [name]_term          Term DB
 * [name]_posting       Posting DB
 * 기존 LDB로 구축된 라이브러리를 MongoDB 용으로 교체
 * @author ChanWoo Kwon
 * @since 0.1.0
 */
var _ = require('lodash');
var mongodb = require('../commons/mongo'),
    util = require('../commons/utils');
var logger = require('../loggers/logger');

/**
 * term에 색인 단어 추가
 * @param db        // mongodb collection
 * @param docs      // words 배열
 * @param callback  // callback 함수
 */
function addTerm(db, docs, callback) {
	var ndocs = _.cloneDeep(docs);
	var terms = {};

	var _loop = function _loop(i) {
		var n = ndocs[i];
		terms = util.mergeSumObj(terms, _(n.tf).forEach(function (val, key) {
			ndocs[i].tf[key] = _.omit(ndocs[i].tf[key], ['tf']); // get only freq
			ndocs[i].tf[key].ndocs = 1;
		}));
	};

	for (var i in ndocs) {
		_loop(i);
	}

	var done = function done(err) {
		if (err) logger.log('error', err.message);

		return callback();
	};
	//console.log(terms);
	return writeToDatabase(db, terms, done);
}

/**
 * posting에 문서 색인 추가
 * @param db            // mongodb collection
 * @param docs          // words 배열
 * @param callback      // callback 함수
 */
function addPosting(db, docs, callback) {
	var ndocs = _.cloneDeep(docs);

	console.log('deep clone complete');

	var terms = {};

	var _loop2 = function _loop2(i) {
		var n = ndocs[i];
		terms = util.mergeSumObj(terms, _(n.tf).forEach(function (val, key) {
			ndocs[i].tf[key] = {};
			ndocs[i].tf[key][n._key] = val.tf;
		}));
	};

	for (var i in ndocs) {
		_loop2(i);
	}

	console.log('make term complete');

	var done = function done(err) {

		console.log('save posting complete');
		if (err) logger.log('error', err.message);

		return callback();
	};

	return writeToDatabase(db, terms, done);
}

function writeToDatabase(db, terms, done) {
	var bulk = db.initializeUnorderedBulkOp();

	for (var key in terms) {
		var val = terms[key];
		bulk.find({ _id: key }).upsert().update({ $inc: val });
	}

	return bulk.execute().then(function () {
		return done();
	}).catch(function (err) {
		return done(err);
	});
}

function insertParentKey(db, docs, parentKeyName, done) {
	var bulk = db.initializeUnorderedBulkOp();

	for (var index in docs) {
		var doc = docs[index];
		//console.log(doc);
		var parentKey = doc[parentKeyName];
		bulk.find({ _id: parentKey }).upsert().update({ $addToSet: { child: doc._key } });
	}

	return bulk.execute().then(function () {
		return done();
	}).catch(function (err) {
		return done(err);
	});
}

function errorHandler(msg, callback) {
	console.error(msg);
	return callback(msg);
}

/**
 * 색인 DB에 추가
 * [name]_term          Term DB
 * [name]_posting       Posting DB
 *
 * @param doc       // 현재 색인할 문서
 * @param opts      // Object {name: 색인 대상 mongodb collection 이름 }
 * @param callback
 */
module.exports = function (doc, opts, callback) {
	//console.log('adder', JSON.stringify(doc));
	callback = callback || _.noop;
	opts = opts || null;

	if (_.isNull(opts)) {
		return errorHandler('adder.js Can not read adder options ', callback);
	}

	if (opts.name === undefined) {
		return errorHandler('adder.js Can not read property [name] of option ', callback);
	}

	//console.log("name", opts.name);
	//console.log(doc);
	var calc = function calc() {
		mongodb.open('index', opts.name + '_term', false).then(function (termdb) {
			return addTerm(termdb, doc, function () {
				return mongodb.open('index', opts.name + '_posting', false).then(function (postingdb) {
					return addPosting(postingdb, doc, function () {

						return callback();
					});
				}).catch(function (err) {
					return errorHandler(err.message, callback);
				});
			});
		}).catch(function (err) {
			return errorHandler(err.message, callback);
		});
	};

	if (opts.parentKey) {
		// -- parent key grouping
		return mongodb.open('index', opts.name + '_group', true).then(function (parentCollection) {
			return insertParentKey(parentCollection, doc, opts.parentKey, function () {
				return calc();
			});
		}).catch(function (err) {
			console.log(err);
		});
	}

	return calc();
};
//# sourceMappingURL=adder.js.map
