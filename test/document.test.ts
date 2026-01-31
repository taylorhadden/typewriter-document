import { AttributeMap, Delta } from '@typewriter/delta';
import { describe, expect, it } from 'vitest';
import Line from '../src/Line.js';
import TextDocument from '../src/TextDocument.js';
import { deltaToText } from '../src/deltaToText.js';

interface LineMatch {
  id?: string;
  attributes?: AttributeMap;
  content?: Delta | string;
}

// Matches sparse values against lines, with optional content-to-string conversion
function expectLinesToMatch(lines: Line[], matches: LineMatch[]) {
  const filteredLines = lines.map((line, index) => {
    const filteredLine: LineMatch = {};
    const match: LineMatch = matches[index] ?? {};
    if (match.id) filteredLine.id = line.id;
    if (match.attributes) filteredLine.attributes = line.attributes;
    if (match.content) {
      if (typeof match.content === 'string') {
        filteredLine.content = deltaToText(line.content);
      } else {
        filteredLine.content = line.content;
      }
    }
    return filteredLine;
  });

  expect(filteredLines).toEqual(matches);
}

describe('Text and Newline Insertion', () => {
  it('Should insert text without newlines into a single line.', () => {
    let doc = new TextDocument();
    doc = doc.apply(doc.change.insert(0, 'Some text'));

    expectLinesToMatch(doc.lines, [
      {
        content: {
          ops: [
            {
              insert: 'Some text',
            },
          ],
        } as Delta,
      },
    ]);
  });

  it('Should split lines when inserting newline characters', () => {
    let doc = new TextDocument();
    doc = doc.apply(doc.change.insert(0, 'Some text'));
    doc = doc.apply(doc.change.insert(doc.length, '\nAnother line'));

    expectLinesToMatch(doc.lines, [
      {
        content: {
          ops: [
            {
              insert: 'Some text',
            },
          ],
        } as Delta,
      },
      {
        content: {
          ops: [
            {
              insert: 'Another line',
            },
          ],
        } as Delta,
      },
    ]);
  });

  describe('Line IDs', () => {
    it('Should create a new line ID for an appended line', () => {
      let doc = new TextDocument();
      doc = doc.apply(doc.change.insert(0, 'Some text'));

      const firstID = doc.lines[0].id;

      doc = doc.apply(doc.change.insert(doc.length, '\nAnother line'));

      expectLinesToMatch(doc.lines, [
        { id: firstID, content: 'Some text' },
        { content: 'Another line' },
      ]);
    });

    it('Should create a new line ID for an inserted line', () => {
      let doc = new TextDocument();
      doc = doc.apply(doc.change.insert(0, 'Some text\non two lines'));

      const firstID = doc.lines[0].id;
      const secondID = doc.lines[1].id;

      doc = doc.apply(doc.change.insert(9, '\nA middle line'));

      expectLinesToMatch(doc.lines, [
        { id: firstID, content: 'Some text' },
        { content: 'A middle line' },
        { id: secondID, content: 'on two lines' },
      ]);

      expect(doc.lines[1].id).not.toEqual(firstID);
      expect(doc.lines[1].id).not.toEqual(secondID);
    });

    it('Should delete the line ID for the deleted line', () => {
      let doc = new TextDocument();
      doc = doc.apply(doc.change.insert(0, 'Some text\nAnother line'));

      const firstID = doc.lines[0].id;
      const newlineIndex = doc.lines[0].length - 1;

      doc = doc.apply(doc.change.delete([newlineIndex, newlineIndex + 1]));

      expectLinesToMatch(doc.lines, [
        { id: firstID, content: 'Some textAnother line' }
      ]);
    });

    it('Should not error when the last newline is deleted', () => {
      let doc = new TextDocument(new Delta([{ insert: '\n', attributes: { header: 1 }}]));
      const firstID = doc.lines[0].id;

      doc = doc.apply(new Delta().insert('abcd\n').delete(1));

      expectLinesToMatch(doc.lines, [
        { id: firstID, content: 'abcd' }
      ]);
    });

    it('Should gracefully handle a delta which does not provide a newline at the end after deleting the document newline', () => {
      let doc = new TextDocument(new Delta([{ insert: '\n', attributes: { header: 1 }}]));
      const firstID = doc.lines[0].id;

      doc = doc.apply(new Delta().insert('abcd').delete(1));

      expectLinesToMatch(doc.lines, [
        { id: firstID, content: 'abcd' }
      ]);
    });
  });
});

describe('Selection Changes', () => {
  it('Should reuse the lines of a document when the only change is setting selection', () => {
    let doc = new TextDocument();
    doc = doc.apply(doc.change.insert(0, 'Some example\nmultiline text'));

    let selectedDoc = doc.apply(doc.change.select([1, 1]));

    expect(selectedDoc.lines === doc.lines).toBeTruthy()
  });

  it('Should reuse the lines of a document when the only change is clearing selection', () => {
    let doc = new TextDocument();
    doc = doc.apply(doc.change.insert(0, 'Some example\nmultiline text').select(2));

    let selectedDoc = doc.apply(doc.change.select(null));

    expect(selectedDoc.lines === doc.lines).toBeTruthy();
  });

  it('Should retain the selection of a document when the selection of a change is undefined', () => {
    let doc = new TextDocument();
    doc = doc.apply(doc.change.insert(0, 'Some example\nmultiline text').select(2));

    let undefinedSelectionDoc = doc.apply(doc.change);

    expect(undefinedSelectionDoc.selection).toEqual(doc.selection);
  });
});
