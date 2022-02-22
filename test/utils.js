import assert from "assert";
import utils from "../lib/utils";

const content = `line one\nline two\nlinethree\nlinefour`;
const contentLF = `line one\nline two\nlinethree\nlinefour`;
const contentCR = `line one\rline two\rlinethree\rlinefour`;
const contentCRLF = `line one\r\nline two\r\nlinethree\r\nlinefour`;

describe("utils: convertLineEnding", function () {
  it("converts LF", function () {
    const converted = utils.convertLineEnding(content, "LF");
    assert.strictEqual(converted, contentLF);
  });

  it("converts CR", function () {
    const converted = utils.convertLineEnding(content, "CR");
    assert.strictEqual(converted, contentCR);
  });

  it("converts CRLF", function () {
    const converted = utils.convertLineEnding(content, "CRLF");
    assert.strictEqual(converted, contentCRLF);
  });
});
