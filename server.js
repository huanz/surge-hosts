'use strict';
var AV = require('leanengine');
var APP_ID = process.env.LC_APP_ID || 'vKn4TsDppPdhAj95nEpepbdR-gzGzoHsz';
var APP_KEY = process.env.LC_APP_KEY || 'UumtwupWty14h7zODMG6FLBy';
var MASTER_KEY = process.env.LC_APP_MASTER_KEY || 'DlGwbB6OSr7vO974pq7f2fd9';
AV.initialize(APP_ID, APP_KEY, MASTER_KEY);
// 如果不希望使用 masterKey 权限，可以将下面一行删除
AV.Cloud.useMasterKey();
var app = require('./app');
// 端口一定要从环境变量 `LC_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LC_APP_PORT || 3000);
app.listen(PORT, function () {
    console.log('surge hosts update app is running, port:', PORT);
});