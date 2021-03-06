var express = require('express'),
	fs = require('fs'),
	bodyParser = require('body-parser'),
    model = require('./model.js'),
    path = require('path'),
    mime = require('mime'),
    server = express(),
    modificationInProgress = false,
    htmlRoot = null,
    pdfLoc = null,
    serverPort = null;

server.use(bodyParser.json());

// Add headers and serve static files
server.use(function(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    res.header("X-Powered-By", "SWS - Software With Style");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    
    if (req.url.indexOf("/api") !== 0) {
        if (req.url === "/") {
            req.url = "/index.html";
        }
        
        var file = path.join(htmlRoot, req.url);
        var type = mime.lookup(file);
        fs.readFile(file, function (err, data) {
            if (err) {
                fs.readFile(path.join(htmlRoot, '404.html'), function(err, data) {
                    if (err) {
                        res.contentType("application/json");
                        res.status(404).send('{"complete":false, "message":"file not found"}');
                    } else {
                        res.status(404);
                        res.contentType("text/html");
                        res.send(data);
                    }
                });
                
                return;
            }
            res.contentType(type);
            res.send(data);
        });
    } else {
        next();
    }
});

// update model
server.post('/api/current', function (req, res) {
    modificationInProgress = true;
	try {
		var json = req.body;
		model.setItemData(json.feature, json.scenario, json.tester, json.passing, json.comment);
		res.contentType("application/json");
		res.send('{"complete":true}');
	}
	catch(e) {
		res.contentType("application/json");
		res.status(500).send('{"complete":false, "message":' + JSON.stringify(e) + ',"data":' + JSON.stringify(req.body) + '}');
    }
    modificationInProgress = false;
});

// get model
server.get('/api/current', function (req, res) {
    var waitFunction = function() {
        if (modificationInProgress) {
            setTimeout(waitFunction, 200);
        }
        res.contentType("application/json");
        res.send(model.currentState());
    };
    waitFunction();
});

// retreive updates
server.get('/api/update', function (req, res) {
	modificationInProgress = true;
	try {
		model.update(function() {
            res.contentType("application/json");
            res.send('{"complete":true}');
		});
	}
	catch(e) {
		res.contentType("application/json");
		res.status(500).send('{"complete":false, "message":' + JSON.stringify(e) + ',"data":' + JSON.stringify(req.body) + '}');
    }
    modificationInProgress = false;
});

// automatically assign members
server.get('/api/autoassign', function (req, res) {
	model.autoAssign();
	res.contentType("application/json");
	res.send('{"complete":true}');
});

// get the pdf
server.get('/api/pdf', function (req, res) {
    var waitFunction = function () {
        if (modificationInProgress) {
            setTimeout(waitFunction, 200);
        }
        fs.readFile(pdfLoc, function (err, data) {
            res.contentType("application/pdf");
            res.send(data);
        });
    };
    waitFunction();
});

// reset the api
server.get('/api/reset', function (req, res) {
	model.refreshData(function() {
		res.contentType("application/json");
		res.send('{"complete":true}');
	});
});

exports.setup = function (port, html) {
    serverPort = port;
    htmlRoot = html;
    pdfLoc = path.join(html, 'ManualTesting.pdf');
};

exports.start = function () {
    model.refreshData(function () {
        server.listen(serverPort);
    });
};