var assert = require('assert');

var wagner = require('../');

describe('core', function() {
  afterEach(function() {
    wagner.clear();
  });

  it('simple timeout', function(done) {
    wagner.task('task1', function(callback) {
      setTimeout(function() {
        callback(null, 'test');
      }, 50);
    });

    wagner.invokeAsync(function(error, task1) {
      assert.ok(!error);
      assert.equal(task1, 'test');
      done();
    }, {});
  });

  it('error', function(done) {
    wagner.task('task1', function(callback) {
      setTimeout(function() {
        callback(null, 'test');
      }, 50);
    });

    wagner.task('taskError', function(callback) {
      setTimeout(function() {
        callback('I got an error');
      }, 25);
    });

    wagner.invokeAsync(function(error, task1, taskError) {
      assert.equal(error, 'I got an error');
      assert.ok(!task1);
      assert.ok(!taskError);
      done();
    });
  });

  it('exception', function(done) {
    wagner.task('task1', function() {
      throw 'error1';
    });

    wagner.task('task2', function(callback) {
      setTimeout(function() {
        callback('I got an error');
      }, 25);
    });

    wagner.invokeAsync(function(error, task1, task2) {
      assert.equal(error, 'error1');
      assert.ok(!task1);
      assert.ok(!task2);
      done();
    });
  });

  it('sync', function() {
    wagner.task('tristan', function() {
      return 'tristan';
    });

    wagner.task('isolde', function() {
      return 'isolde';
    });

    var returnValue = wagner.invoke(function(error, tristan, isolde) {
      assert.ok(!error);
      assert.equal(tristan, 'tristan');
      assert.equal(isolde, 'isolde');

      return 'done';
    });

    assert.equal(returnValue, 'done');
  });

  it('async with sync-only', function(done) {
    wagner.task('tristan', function() {
      return 'tristan';
    });

    wagner.task('isolde', function() {
      return 'isolde';
    });

    wagner.invokeAsync(function(error, tristan, isolde) {
      assert.ifError(error);
      assert.equal('tristan', tristan);
      assert.equal('isolde', isolde);
      done();
    });
  });

  it('sync errors', function() {
    wagner.task('task1', function() {
      return 'tristan';
    });

    wagner.task('task2', function() {
      throw 'Problem!';
    });

    assert.throws(function() {
      var returnValue = wagner.invoke(function(error, task1, task2) {
        return 'done';
      });
    }, 'Problem!');
  });

  it('recursive', function(done) {
    wagner.task('tristan', function(callback) {
      setTimeout(function() {
        callback(null, 'tristan');
      }, 50);
    });

    wagner.task('isolde', function(tristan, callback) {
      setTimeout(function() {
        callback(null, tristan + ' & isolde');
      }, 25);
    });

    wagner.invokeAsync(function(error, tristan, isolde) {
      assert.ok(!error);
      assert.equal(tristan, 'tristan');
      assert.equal(isolde, 'tristan & isolde');
      done();
    });
  });

  it('without error', function(done) {
    wagner.task('tristan', function(callback) {
      setTimeout(function() {
        callback(null, 'tristan');
      }, 50);
    });

    wagner.task('isolde', function(tristan, callback) {
      setTimeout(function() {
        callback(null, tristan + ' & isolde');
      }, 25);
    });

    wagner.invokeAsync(function(tristan, isolde) {
      assert.equal(tristan, 'tristan');
      assert.equal(isolde, 'tristan & isolde');
      done();
    });
  });

  it('factory', function(done) {
    wagner.factory('v', function() {
      return { hello: 'world' };
    });

    wagner.task('task1', function(v, callback) {
      setTimeout(function() {
        callback(null, v);
      }, 25);
    });

    wagner.invokeAsync(function(error, task1) {
      assert.ok(!error);
      assert.equal(task1.hello, 'world');
      done();
    });
  });

  it('only executes necessary tasks', function(done) {
    wagner.factory('nothung', function() {
      return { from: 'barnstokkr' };
    });

    wagner.task('sigfried', function(nothung, callback) {
      setTimeout(function() {
        callback(null, { sword: nothung });
      }, 25);
    });

    var sigmund = 0;
    wagner.task('sigmund', function(nothung, callback) {
      ++sigmund;
      setTimeout(function() {
        callback(null, { sword: nothung });
      }, 25);
    });

    wagner.invokeAsync(function(error, sigfried) {
      assert.ok(!error);
      assert.equal(sigfried.sword.from, 'barnstokkr');
      assert.ok(!sigmund);
      done();
    });
  });

  it('locals', function(done) {
    wagner.task('sigfried', function(nothung, callback) {
      setTimeout(function() {
        callback(null, { sword: nothung });
      }, 25);
    });

    wagner.invokeAsync(
      function(error, sigfried) {
        assert.ok(!error);
        assert.equal(sigfried.sword.from, 'barnstokkr');
        done();
      },
      { nothung: { from: 'barnstokkr' } });
  });

  it('async errors', function(done) {
    wagner.task('sigfried', function(callback) {
      throw 'Problem!';
    });

    wagner.invokeAsync(
      function(error, sigfried) {
        assert.ok(error);
        assert.ok(!sigfried);
        assert.equal(error, 'Problem!');
        done();
      });
  });

  it('locals with error', function(done) {
    wagner.task('sigfried', function(callback) {
      throw 'Problem!';
    });

    wagner.invokeAsync(
      function(error, sigfried, local) {
        assert.ok(error);
        assert.ok(!sigfried);
        assert.equal(error, 'Problem!');
        assert.equal('defined', local);
        done();
      },
      { local: 'defined' });
  });

  it('reuses services', function(done) {
    var value = { count: 1 };
    var callCount = 0;
    wagner.factory('bacon', function() {
      ++callCount;
      return value;
    });

    wagner.task('breakfast', function(bacon, callback) {
      assert.equal(value, bacon);
      callback(null);
    });

    wagner.task('lunch', function(bacon, callback) {
      assert.equal(value, bacon);
      callback(null);
    });

    wagner.invokeAsync(function(breakfast) {
      assert.equal(1, callCount);
      wagner.invokeAsync(function(lunch) {
        assert.equal(1, callCount);
        done();
      });
    });
  });
});

describe('parallel', function() {
  it('works', function(done) {
    wagner.parallel(
      { first: 'parsifal', second: 'gotterdammerung' },
      function(value, key, callback) {
        callback(null, value.toUpperCase());
      },
      function(error, results) {
        assert.ifError(error);
        assert.equal(results.first, 'PARSIFAL');
        assert.equal(results.second, 'GOTTERDAMMERUNG');
        done();
      });
  });

  it('returns errors', function(done) {
    wagner.parallel(
      { first: 'parsifal', second: 'gotterdammerung' },
      function(value, key, callback) {
        callback(key + ' invalid');
      },
      function(error, results) {
        assert.ok(!!error);
        assert.equal(2, Object.keys(error.errors).length);
        assert.equal(error.errors.first, 'first invalid');
        assert.equal(error.errors.second, 'second invalid');
        assert.ok(!results.first);
        assert.ok(!results.second);
        done();
      });
  });

  it('catches errors', function(done) {
    wagner.parallel(
      { first: 'parsifal', second: 'gotterdammerung' },
      function(value, key, callback) {
        throw key + ' invalid';
      },
      function(error, results) {
        assert.ok(!!error);
        assert.equal(2, Object.keys(error.errors).length);
        assert.equal(error.errors.first, 'first invalid');
        assert.equal(error.errors.second, 'second invalid');
        assert.ok(!results.first);
        assert.ok(!results.second);
        done();
      });
  });
});

describe('series', function() {
  it('works', function(done) {
    wagner.series(
      ['parsifal', 'gotterdammerung'],
      function(value, index, callback) {
        callback(null, value.toUpperCase());
      },
      function(error, results) {
        assert.ok(!error);
        assert.equal(results[0], 'PARSIFAL');
        assert.equal(results[1], 'GOTTERDAMMERUNG');
        done();
      });
  });

  it('catches errors', function(done) {
    wagner.series(
      ['parsifal', 'gotterdammerung'],
      function(value, index, callback) {
        if (index > 0) {
          throw value;
        } else {
          callback(null, value);

        }
      },
      function(error, results) {
        assert.ok(!!error);
        assert.ok(!results);
        assert.equal(error.error, 'gotterdammerung');
        assert.equal(error.index, 1);
        done();
      });
  });
});

describe('modules', function() {
  it('works', function(done) {
    var foods = wagner.module('foods');
    foods.factory('bacon', function() {
      return 'bacon';
    });
    foods.factory('eggs', function() {
      return 'eggs';
    });

    var breakfast = wagner.module('breakfast', ['foods']);
    breakfast.invoke(function(error, bacon, eggs) {
      assert.ok(!error);
      assert.equal(bacon, 'bacon');
      assert.equal(eggs, 'eggs');
      done();
    });
  });

  it('can use wagner() as shorthand', function(done) {
    var foods = wagner('foods');
    foods.factory('bacon', function() {
      return 'bacon';
    });
    foods.factory('eggs', function() {
      return 'eggs';
    });

    var breakfast = wagner.module('breakfast', ['foods']);
    breakfast.invoke(function(error, bacon, eggs) {
      assert.ok(!error);
      assert.equal(bacon, 'bacon');
      assert.equal(eggs, 'eggs');
      done();
    });
  });
});
