'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.code = code;
exports.content = content;
/**
 *
 * @author ChanWoo Kwon
 * date : 2018-05-08
 */

var mongodb = require('../../components/commons/mongo');
var properties = require('../../config/environment');

var SimilarityChecker = require('../../components/similarity/SimilarityChecker');
var similarityChecker = new SimilarityChecker();

function code(req, res) {
	var list = req.body.list;
	var db = req.body.name;
	var ratio = req.body.limitRatio;

	mongodb.open('similarity', 'coredb', false).then(function (collection) {
		collection.findOne({ _id: db }, function (err, doc) {

			if (err) {
				return res.json({
					result: 'fail',
					message: err.message
				});
			}

			return similarityChecker.readContentFromCode(doc.apiurl, db, list, ratio).then(function (rank) {
				return res.json({
					res: rank
				});
			}).catch(function (err) {
				return res.json({
					result: 'fail',
					message: err.message
				});
			});
		});
	}).catch(function (err) {
		return res.json({
			result: 'fail',
			message: err.message
		});
	});
}

function content(req, res) {
	var list = req.body.list;
	var ratio = req.body.limitRatio;

	return similarityChecker.getSimilarityContent(properties.apiurl, list, ratio).then(function (res) {
		return res.json({});
	}).catch(function (err) {
		return res.json({
			result: 'fail',
			message: res.message
		});
	});
}
//# sourceMappingURL=similarity.controller.js.map
