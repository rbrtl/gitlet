var fs = require("fs");
var nodePath = require("path");
var g = require("../src/gitlet");
var testUtil = require("./test-util");

var makeRemoteRepo = function() {
  process.chdir("../");
  fs.mkdirSync("sub");
  process.chdir("sub");
  fs.mkdirSync("repo2");
  process.chdir("repo2");
  return process.cwd();
};

describe("fetch", function() {
  beforeEach(testUtil.initTestDataDir);
  beforeEach(testUtil.pinDate);
  afterEach(testUtil.unpinDate);

  it("should throw if not in repo", function() {
    expect(function() { g.fetch(); })
      .toThrow("fatal: Not a gitlet repository (or any of the parent directories): .gitlet");
  });

  it("should throw if remote does not exist", function() {
    g.init();
    expect(function() { g.fetch("origin"); })
      .toThrow("fatal: 'origin' does not appear to be a git repository");
  });

  it("should not support git fetch with no name", function() {
    g.init();
    expect(function() { g.fetch(); }).toThrow("unsupported");
  });

  it("should be able to fetch objects for main branch on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    ["21cb63f6", "63e0627e", "17653b6d", "5ceba65", // first commit
     "1c4100dd", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join(".gitlet/objects", h), exp);
      });
  });

  it("should set master to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });
    var remoteMasterHash = fs.readFileSync(".gitlet/refs/heads/master", "utf8");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    testUtil.expectFile(".gitlet/refs/remotes/origin/master", remoteMasterHash);
  });

  it("should be able to pull objects over only referenced by non-master branches", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other");

    gr.checkout("other");
    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    ["21cb63f6", "63e0627e", "17653b6d", "5ceba65", // first commit
     "1c4100dd", "794ea686", "507bf191", "5ceba66"] // second commit
      .forEach(function(h) {
        var exp = fs.readFileSync(nodePath.join(remoteRepo, ".gitlet", "objects", h), "utf8");
        testUtil.expectFile(nodePath.join(".gitlet/objects", h), exp);
      });
  });

  it("should set other branch to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other");
    var remoteOtherHash = fs.readFileSync(".gitlet/refs/heads/other", "utf8");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    gl.fetch("origin");

    testUtil.expectFile(".gitlet/refs/remotes/origin/other", remoteOtherHash);
  });

  it("should announce which origin it fetched from", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    expect(gl.fetch("origin")).toMatch("From " + remoteRepo);
  });

  it("should announce total objects transferred from remote (all of them)", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);
    expect(gl.fetch("origin")).toMatch("Count 4");
  });

  it("should announce count of all objs transf when some already transf", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();
    gr.add("1a/filea");
    gr.commit({ m: "first" });

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    process.chdir(remoteRepo);
    gr.add("1b/fileb");
    gr.commit({ m: "second" });

    process.chdir(localRepo);
    expect(gl.fetch("origin")).toMatch("Count 8");
  });

  it("should set other branch to hash value it has on remote", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other1");
    gr.branch("other2");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    var fetchReport = gl.fetch("origin");
    expect(fetchReport).toMatch(/\* \[new branch\] other1 -> origin\/other1/);
    expect(fetchReport).toMatch(/\* \[new branch\] other2 -> origin\/other2/);
  });

  it("should format return value nicely", function() {
    var gl = g, gr = g;
    var localRepo = process.cwd();
    var remoteRepo = makeRemoteRepo();

    gr.init();
    testUtil.createStandardFileStructure();

    gr.add("1a/filea");
    gr.commit({ m: "first" });
    gr.branch("other1");
    gr.branch("other2");

    process.chdir(localRepo);
    gl.init();
    gl.remote("add", "origin", remoteRepo);

    expect(gl.fetch("origin")).toEqual("From " + remoteRepo + "\n" +
                                       "Count 4\n" +
                                       "* [new branch] master -> origin/master\n" +
                                       "* [new branch] other1 -> origin/other1\n" +
                                       "* [new branch] other2 -> origin/other2\n");
  });
});