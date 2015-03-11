var p = {
  x: 'y'
};
var o = {
  __proto__: p,
  m1() {
    var o2 = {
      get [super.x]() { return 1; }
    };
    return o2.y;
  },
  m2() {
    var o2 = {
      [super.x]: 2
    };
    return o2.y;
  },
  m3() {
    var o2 = {
      [super.x]() { return 3; }
    };
    return o2.y();
  },
};

assert.equal(1, o.m1());
assert.equal(2, o.m2());
assert.equal(3, o.m3());
