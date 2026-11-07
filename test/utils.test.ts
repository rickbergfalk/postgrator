import assert from "assert";
import utils from "../src/lib/utils.js";
import { describe, it } from "node:test";

const content = `line one\nline two\nlinethree\nlinefour`;
const contentLF = `line one\nline two\nlinethree\nlinefour`;
const contentCR = `line one\rline two\rlinethree\rlinefour`;
const contentCRLF = `line one\r\nline two\r\nlinethree\r\nlinefour`;

void describe("utils: convertLineEnding", function () {
  void it("converts LF", function () {
    const converted = utils.convertLineEnding(content, "LF");
    assert.strictEqual(converted, contentLF);
  });

  void it("converts CR", function () {
    const converted = utils.convertLineEnding(content, "CR");
    assert.strictEqual(converted, contentCR);
  });

  void it("converts CRLF", function () {
    const converted = utils.convertLineEnding(content, "CRLF");
    assert.strictEqual(converted, contentCRLF);
  });
});
