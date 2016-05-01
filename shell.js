var exec = require('child_process').exec;

exports.exec = function (cmd, cb) {
    var p = exec(cmd);
    p.stdout.on('data', function (data) {
        console.log(data);
    });
    p.stderr.on('data', function (data) {
        console.log(data);
    });
    p.on('close', function (code) {
        var err = null;
        if (code) {
            err = new Error('command "' + cmd + '" exited with wrong status code "' + code + '"');
            err.code = code;
            err.cmd = cmd;
        }
        if (cb) cb(err);
    });
};

exports.series = function (cmds, cb) {
    var execNext = function () {
        exports.exec(cmds.shift(), function (err) {
            if (err) {
                cb(err);
            } else {
                cmds.length ? execNext() : cb(null);
            }
        });
    };
    execNext();
};