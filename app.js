'use strict';
var fs = require('fs');
var express = require('express');
var timeout = require('connect-timeout');
var path = require('path');
var bodyParser = require('body-parser');
var AV = require('leanengine');

var surge = require('./surge');
var status = require('./status');

var app = express();

// 设置 view 引擎
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// 设置默认超时时间
app.use(timeout('15s'));

// 加载云引擎中间件
app.use(AV.express());

app.enable('trust proxy');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

app.get('/', function (req, res) {
    res.render('index', status);
}).post('/', function (req, res) {
    if (!status.status) {
        status.status = 1;
        surge.update({
            time: status.time
        }, function (err) {
            status.status = 0;
            if (!err) {
                console.log('更新hosts成功');
                status.time = Date.now();
                fs.writeFileSync('status.json', JSON.stringify(status));
            } else {
                console.log(err);
            }
        });
    }
    res.render('index', status);
});

app.use(function (req, res, next) {
    // 如果任何一个路由都没有返回响应，则抛出一个 404 异常给后续的异常处理器
    if (!res.headersSent) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
});
// error handlers
app.use(function (err, req, res, next) {
    if (req.timedout && req.headers.upgrade === 'websocket') {
        // 忽略 websocket 的超时
        return;
    }
    var statusCode = err.status || 500;
    if (statusCode === 500) {
        console.error(err.stack || err);
    }
    if (req.timedout) {
        console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
    }
    res.status(statusCode);
    // 默认不输出异常详情
    var error = {};
    if (app.get('env') === 'development') {
        // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
        error = err;
    }
    res.render('error', {
        message: err.message,
        error: error
    });
});

module.exports = app;